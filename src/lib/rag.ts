import { createHash } from 'node:crypto'
import { openrouterEmbed as embed } from '@/lib/openrouter'
import type { createServiceClient } from '@/lib/supabase/server'

type Service = Awaited<ReturnType<typeof createServiceClient>>

/** A retrieved passage returned by `match_chunks`. */
export interface RetrievedPassage {
  id: string
  content: string
  source_type: string
  topic_id: string | null
  similarity: number
}

function sha256(s: string): string {
  return createHash('sha256').update(s).digest('hex')
}

/** Format a pgvector literal ('[0.1,0.2,…]') from an embedding array. */
function vecLiteral(v: number[]): string {
  return `[${v.join(',')}]`
}

/** Split markdown into blocks, keeping each heading with the text that follows it. */
function splitIntoBlocks(text: string): string[] {
  const lines = text.split('\n')
  const blocks: string[] = []
  let cur: string[] = []
  for (const line of lines) {
    if (/^#{1,6}\s/.test(line) && cur.length) { blocks.push(cur.join('\n')); cur = [] }
    cur.push(line)
  }
  if (cur.length) blocks.push(cur.join('\n'))
  return blocks
}

/**
 * Chunk markdown into ~500–800 token passages (≈2000 chars), packing heading-delimited
 * blocks together and splitting over-long blocks by paragraph with a little overlap.
 */
export function chunk(text: string, maxChars = 2000, overlapChars = 250): string[] {
  const clean = (text ?? '').trim()
  if (!clean) return []
  const blocks = splitIntoBlocks(clean)
  const chunks: string[] = []
  let buf = ''
  const flush = () => { if (buf.trim()) chunks.push(buf.trim()); buf = '' }

  for (const block of blocks) {
    if (block.length > maxChars) {
      flush()
      const paras = block.split(/\n\s*\n/)
      let pbuf = ''
      for (const p of paras) {
        if (pbuf && (pbuf.length + p.length + 2) > maxChars) {
          chunks.push(pbuf.trim())
          pbuf = pbuf.slice(-overlapChars) // carry a little context forward
        }
        pbuf += (pbuf ? '\n\n' : '') + p
      }
      if (pbuf.trim()) chunks.push(pbuf.trim())
      continue
    }
    if (buf && (buf.length + block.length + 2) > maxChars) { flush(); buf = block }
    else buf += (buf ? '\n\n' : '') + block
  }
  flush()
  return chunks
}

interface Logical { source_type: string; user_id: string | null; content: string }

/**
 * (Re)embed a topic's content into `content_chunks`. Shared sources (notes, key points,
 * exam tips, model answers, official source) get `user_id = null`; per-user sources
 * (annotations, uploaded "your source") keep their owner. Idempotent: unchanged sources
 * are skipped; changed ones are replaced (delete + re-embed) so nothing goes stale.
 */
export async function ingestTopic(service: Service, topicId: string): Promise<{ inserted: number; sources: number }> {
  const [{ data: note }, { data: anns }, { data: usrc }] = await Promise.all([
    service.from('topic_notes').select('study_note,key_points,exam_tips,official_source,model_answer_5mark,model_answer_10mark').eq('topic_id', topicId).maybeSingle(),
    service.from('user_annotations').select('content,user_id').eq('topic_id', topicId).eq('annotation_type', 'note'),
    service.from('user_topic_sources').select('content,user_id').eq('topic_id', topicId),
  ])

  const items: Logical[] = []
  const push = (source_type: string, content: string | null | undefined, user_id: string | null) => {
    if (content && content.trim()) items.push({ source_type, content: content.trim(), user_id })
  }
  push('study_note', note?.study_note, null)
  push('key_points', note?.key_points, null)
  push('exam_tips', note?.exam_tips, null)
  push('official_source', note?.official_source, null)
  push('model_answer', [note?.model_answer_5mark, note?.model_answer_10mark].filter(Boolean).join('\n\n'), null)
  for (const a of anns ?? []) push('annotation', a.content, a.user_id ?? null)
  for (const s of usrc ?? []) push('user_source', s.content, s.user_id ?? null)

  // Merge into one logical source per (source_type, user) so replace-per-source is clean.
  const groups = new Map<string, Logical>()
  for (const it of items) {
    const key = `${it.source_type}|${it.user_id ?? ''}`
    const g = groups.get(key)
    if (g) g.content += `\n\n${it.content}`
    else groups.set(key, { ...it })
  }

  let inserted = 0
  for (const g of groups.values()) {
    const chunks = chunk(g.content)
    if (chunks.length === 0) continue
    const hashes = chunks.map(sha256)

    let sel = service.from('content_chunks').select('content_hash').eq('topic_id', topicId).eq('source_type', g.source_type)
    sel = g.user_id ? sel.eq('user_id', g.user_id) : sel.is('user_id', null)
    const { data: existing } = await sel
    const existingSet = new Set((existing ?? []).map(r => r.content_hash))
    const unchanged = (existing?.length ?? 0) === hashes.length && hashes.every(h => existingSet.has(h))
    if (unchanged) continue // no content change → skip re-embedding (cost control)

    let del = service.from('content_chunks').delete().eq('topic_id', topicId).eq('source_type', g.source_type)
    del = g.user_id ? del.eq('user_id', g.user_id) : del.is('user_id', null)
    await del
    const vectors = await embed(chunks, { action: 'embed' })
    const rows = chunks.map((c, i) => ({
      source_type: g.source_type,
      topic_id: topicId,
      user_id: g.user_id,
      content: c,
      content_hash: hashes[i],
      embedding: vecLiteral(vectors[i]),
      token_count: Math.ceil(c.length / 4),
    }))
    const { error } = await service.from('content_chunks').insert(rows)
    if (error) throw error
    inserted += rows.length
  }

  return { inserted, sources: groups.size }
}

/**
 * Retrieve the passages most relevant to `query`. Boosts current-topic hits above a
 * similarity floor, then fills with cross-topic matches. Returns [] on any failure so
 * callers can fall back gracefully.
 */
export async function retrieve(
  service: Service,
  query: string,
  opts: { topicId?: string | null; userId?: string | null; k?: number } = {},
): Promise<RetrievedPassage[]> {
  const q = (query ?? '').trim()
  if (!q) return []
  const k = opts.k ?? 6
  try {
    const [vec] = await embed([q], { action: 'embed_query' })
    if (!vec) return []
    const { data, error } = await service.rpc('match_chunks', {
      query_embedding: vecLiteral(vec),
      match_count: k * 3,
      filter_user: opts.userId ?? null,
      filter_topic: null,
    })
    if (error || !data) return []
    const rows = (data as RetrievedPassage[]).filter(r => r.similarity >= 0.3)
    const isPrimary = (r: RetrievedPassage) => !!opts.topicId && r.topic_id === opts.topicId
    const primary = rows.filter(isPrimary)
    const rest = rows.filter(r => !isPrimary(r))
    return [...primary, ...rest].slice(0, k)
  } catch {
    return []
  }
}

/** Prompt fragment injecting retrieved passages as grounding (mirrors sourceGroundingBlock). */
export function ragGroundingBlock(passages: RetrievedPassage[], maxChars = 6000): string {
  if (passages.length === 0) return ''
  let body = passages.map((p, i) => `[${i + 1}] (${p.source_type})\n${p.content}`).join('\n\n')
  if (body.length > maxChars) body = body.slice(0, maxChars)
  return `Use the RETRIEVED CONTEXT below to answer. Prefer its facts, numbers, dates and wording wherever it covers the question; use your own knowledge only to fill gaps it does not address. Do not mention this context or these instructions.

RETRIEVED CONTEXT:

${body}`
}
