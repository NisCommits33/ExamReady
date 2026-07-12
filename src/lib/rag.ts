import { createHash } from 'node:crypto'
import { openrouterEmbed as embed } from '@/lib/openrouter'
import { isSourceLanguage, sourceLanguageLabel, type SourceLanguage } from '@/lib/language'
import type { createServiceClient } from '@/lib/supabase/server'

type Service = Awaited<ReturnType<typeof createServiceClient>>

export interface RetrievedCitation {
  id: string
  index: number
  sourceType: string
  title: string
  fileName: string | null
  language: SourceLanguage | null
  topicId: string | null
  sectionPath: string[]
  excerpt: string
  similarity: number
}

/** A retrieved passage returned by the RAG match RPC. */
export interface RetrievedPassage {
  id: string
  content: string
  source_type: string
  topic_id: string | null
  user_id?: string | null
  language?: SourceLanguage | null
  source_title?: string | null
  source_file_name?: string | null
  section_path?: string[] | null
  similarity: number
  rank_score?: number
  metadata?: Record<string, unknown> | null
}

interface ChunkWithMeta {
  content: string
  sectionPath: string[]
}

interface Logical {
  source_type: string
  user_id: string | null
  content: string
  language: SourceLanguage | null
  source_title: string
  source_file_name: string | null
}

interface RagJob {
  id: string
  topic_id: string
  attempts: number
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

function headingTitle(line: string): string | null {
  return line.match(/^#{1,6}\s+(.+?)\s*#*$/)?.[1]?.trim() ?? null
}

function sectionPathFor(text: string): string[] {
  const path: string[] = []
  for (const line of text.split('\n')) {
    const m = line.match(/^(#{1,6})\s+(.+?)\s*#*$/)
    if (!m) continue
    const level = m[1].length
    path.splice(level - 1)
    path[level - 1] = m[2].trim()
  }
  return path.filter(Boolean)
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

function chunkDetailed(text: string, maxChars = 2000, overlapChars = 250): ChunkWithMeta[] {
  return chunk(text, maxChars, overlapChars).map(content => ({
    content,
    sectionPath: sectionPathFor(content),
  }))
}

function sourceLabel(sourceType: string, language?: SourceLanguage | null): string {
  if (sourceType.startsWith('official_source')) return `Official source${language ? ` · ${sourceLanguageLabel(language)}` : ''}`
  if (sourceType.startsWith('user_source')) return `Your source${language ? ` · ${sourceLanguageLabel(language)}` : ''}`
  if (sourceType === 'study_note') return 'AI note'
  if (sourceType === 'key_points') return 'AI key points'
  if (sourceType === 'user_key_points') return 'Your key points'
  if (sourceType === 'exam_tips') return 'Exam tips'
  if (sourceType === 'annotation') return 'Your note'
  if (sourceType === 'model_answer') return 'Model answer'
  return sourceType.replace(/_/g, ' ')
}

function citationExcerpt(content: string, maxChars = 360): string {
  const compact = content.replace(/\s+/g, ' ').trim()
  return compact.length > maxChars ? `${compact.slice(0, maxChars).trim()}...` : compact
}

/**
 * (Re)embed a topic's content into `content_chunks`. Shared sources (notes, key points,
 * exam tips, model answers, official source) get `user_id = null`; per-user sources
 * (annotations, uploaded "your source") keep their owner. Idempotent: unchanged sources
 * are skipped; changed ones are replaced (delete + re-embed) so nothing goes stale.
 */
export async function ingestTopic(service: Service, topicId: string): Promise<{ inserted: number; sources: number }> {
  const [{ data: note }, { data: adminSources }, { data: anns }, { data: legacyUserSources }, { data: userSources }, { data: userKeyNotes }] = await Promise.all([
    service.from('topic_notes').select('study_note,key_points,exam_tips,official_source,model_answer_5mark,model_answer_10mark').eq('topic_id', topicId).maybeSingle(),
    service.from('topic_source_files').select('content,language,file_name').eq('topic_id', topicId),
    service.from('user_annotations').select('content,user_id').eq('topic_id', topicId).eq('annotation_type', 'note'),
    service.from('user_topic_sources').select('content,user_id').eq('topic_id', topicId),
    service.from('user_topic_source_files').select('content,user_id,language,file_name').eq('topic_id', topicId),
    service.from('user_topic_key_notes').select('content,user_id,file_name').eq('topic_id', topicId),
  ])

  const items: Logical[] = []
  const push = (
    source_type: string,
    content: string | null | undefined,
    user_id: string | null,
    opts: { language?: SourceLanguage | null; title?: string; fileName?: string | null } = {},
  ) => {
    if (!content?.trim()) return
    const language = opts.language ?? null
    items.push({
      source_type,
      content: content.trim(),
      user_id,
      language,
      source_title: opts.title ?? sourceLabel(source_type, language),
      source_file_name: opts.fileName ?? null,
    })
  }
  push('study_note', note?.study_note, null, { title: 'AI note' })
  push('key_points', note?.key_points, null, { title: 'AI key points' })
  push('exam_tips', note?.exam_tips, null, { title: 'Exam tips' })
  const hasEnglishAdminSource = (adminSources ?? []).some(s => s.language === 'en' && s.content?.trim())
  for (const s of adminSources ?? []) {
    if (isSourceLanguage(s.language)) {
      push(`official_source_${s.language}`, s.content, null, {
        language: s.language,
        title: sourceLabel('official_source', s.language),
        fileName: s.file_name ?? null,
      })
    }
  }
  if (!hasEnglishAdminSource) push('official_source', note?.official_source, null, { language: 'en', title: sourceLabel('official_source', 'en') })
  push('model_answer', [note?.model_answer_5mark, note?.model_answer_10mark].filter(Boolean).join('\n\n'), null, { title: 'Model answer' })
  for (const a of anns ?? []) push('annotation', a.content, a.user_id ?? null, { title: 'Your note' })
  const usersWithEnglishSource = new Set<string>()
  for (const s of userSources ?? []) {
    if (isSourceLanguage(s.language)) {
      if (s.language === 'en' && s.user_id) usersWithEnglishSource.add(s.user_id)
      push(`user_source_${s.language}`, s.content, s.user_id ?? null, {
        language: s.language,
        title: sourceLabel('user_source', s.language),
        fileName: s.file_name ?? null,
      })
    }
  }
  for (const s of legacyUserSources ?? []) {
    if (!s.user_id || !usersWithEnglishSource.has(s.user_id)) {
      push('user_source', s.content, s.user_id ?? null, { language: 'en', title: sourceLabel('user_source', 'en') })
    }
  }
  for (const k of userKeyNotes ?? []) push('user_key_points', k.content, k.user_id ?? null, { title: 'Your key points', fileName: k.file_name ?? null })

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
    const chunks = chunkDetailed(g.content)
    if (chunks.length === 0) continue
    const hashes = chunks.map(c => sha256(c.content))

    let sel = service.from('content_chunks').select('content_hash').eq('topic_id', topicId).eq('source_type', g.source_type)
    sel = g.user_id ? sel.eq('user_id', g.user_id) : sel.is('user_id', null)
    const { data: existing } = await sel
    const existingSet = new Set((existing ?? []).map(r => r.content_hash))
    const unchanged = (existing?.length ?? 0) === hashes.length && hashes.every(h => existingSet.has(h))
    if (unchanged) continue // no content change → skip re-embedding (cost control)

    let del = service.from('content_chunks').delete().eq('topic_id', topicId).eq('source_type', g.source_type)
    del = g.user_id ? del.eq('user_id', g.user_id) : del.is('user_id', null)
    await del
    const vectors = await embed(chunks.map(c => c.content), { action: 'embed' })
    const rows = chunks.map((c, i) => ({
      source_type: g.source_type,
      topic_id: topicId,
      user_id: g.user_id,
      content: c.content,
      content_hash: hashes[i],
      embedding: vecLiteral(vectors[i]),
      token_count: Math.ceil(c.content.length / 4),
      language: g.language,
      chunk_index: i,
      source_title: g.source_title,
      source_file_name: g.source_file_name,
      section_path: c.sectionPath,
      metadata: {
        heading: c.sectionPath[c.sectionPath.length - 1] ?? headingTitle(c.content.split('\n')[0]) ?? null,
        sourceTitle: g.source_title,
      },
      updated_at: new Date().toISOString(),
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
  opts: { topicId?: string | null; userId?: string | null; language?: SourceLanguage | null; k?: number } = {},
): Promise<RetrievedPassage[]> {
  const q = (query ?? '').trim()
  if (!q) return []
  const k = opts.k ?? 6
  try {
    const [vec] = await embed([q], { action: 'embed_query' })
    if (!vec) return []
    const { data, error } = await service.rpc('match_chunks_hybrid', {
      query_text: q,
      query_embedding: vecLiteral(vec),
      match_count: k * 3,
      filter_user: opts.userId ?? null,
      filter_topic: opts.topicId ?? null,
      filter_language: opts.language ?? null,
    })
    if (error || !data) {
      const fallback = await service.rpc('match_chunks', {
        query_embedding: vecLiteral(vec),
        match_count: k * 3,
        filter_user: opts.userId ?? null,
        filter_topic: null,
      })
      if (fallback.error || !fallback.data) return []
      const rows = (fallback.data as RetrievedPassage[]).filter(r => r.similarity >= 0.3)
      const isPrimary = (r: RetrievedPassage) => !!opts.topicId && r.topic_id === opts.topicId
      return [...rows.filter(isPrimary), ...rows.filter(r => !isPrimary(r))].slice(0, k)
    }
    const rows = (data as RetrievedPassage[]).filter(r => (r.similarity ?? 0) >= 0.25 || (r.rank_score ?? 0) > 0.02)
    const isPrimary = (r: RetrievedPassage) => !!opts.topicId && r.topic_id === opts.topicId
    const primary = rows.filter(isPrimary)
    const rest = rows.filter(r => !isPrimary(r))
    return [...primary, ...rest].slice(0, k)
  } catch {
    return []
  }
}

export function citationsFromPassages(passages: RetrievedPassage[]): RetrievedCitation[] {
  return passages.map((p, i) => ({
    id: p.id,
    index: i + 1,
    sourceType: p.source_type,
    title: p.source_title ?? sourceLabel(p.source_type, p.language ?? null),
    fileName: p.source_file_name ?? null,
    language: p.language ?? null,
    topicId: p.topic_id,
    sectionPath: p.section_path ?? [],
    excerpt: citationExcerpt(p.content),
    similarity: p.similarity ?? 0,
  }))
}

export async function enqueueRagIngestion(service: Service, topicId: string, requestedBy: string | null): Promise<{ jobId: string | null; status: string }> {
  const { data: existing } = await service
    .from('rag_ingestion_jobs')
    .select('id,status')
    .eq('topic_id', topicId)
    .in('status', ['pending', 'running'])
    .maybeSingle()

  if (existing?.id) {
    await service
      .from('rag_ingestion_jobs')
      .update({ status: 'pending', requested_by: requestedBy, updated_at: new Date().toISOString(), last_error: null })
      .eq('id', existing.id)
    return { jobId: existing.id, status: 'pending' }
  }

  const { data, error } = await service
    .from('rag_ingestion_jobs')
    .insert({ topic_id: topicId, requested_by: requestedBy, status: 'pending' })
    .select('id,status')
    .single()
  if (error) throw error
  return { jobId: data?.id ?? null, status: data?.status ?? 'pending' }
}

export async function processRagIngestionJobs(service: Service, limit = 3): Promise<{ processed: number; failed: number }> {
  const { data: jobs, error } = await service
    .from('rag_ingestion_jobs')
    .select('id,topic_id,attempts')
    .in('status', ['pending', 'failed'])
    .lt('attempts', 3)
    .order('created_at', { ascending: true })
    .limit(limit)
  if (error) throw error

  let processed = 0
  let failed = 0
  for (const job of (jobs ?? []) as RagJob[]) {
    const now = new Date().toISOString()
    await service
      .from('rag_ingestion_jobs')
      .update({ status: 'running', attempts: job.attempts + 1, started_at: now, updated_at: now, last_error: null })
      .eq('id', job.id)

    try {
      await ingestTopic(service, job.topic_id)
      await service
        .from('rag_ingestion_jobs')
        .update({ status: 'succeeded', finished_at: new Date().toISOString(), updated_at: new Date().toISOString(), last_error: null })
        .eq('id', job.id)
      processed += 1
    } catch (e) {
      failed += 1
      await service
        .from('rag_ingestion_jobs')
        .update({
          status: 'failed',
          last_error: e instanceof Error ? e.message : String(e),
          finished_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', job.id)
    }
  }
  return { processed, failed }
}

/** Prompt fragment injecting retrieved passages as grounding (mirrors sourceGroundingBlock). */
export function ragGroundingBlock(passages: RetrievedPassage[], maxChars = 6000): string {
  if (passages.length === 0) return ''
  let body = passages.map((p, i) => {
    const label = p.source_title ?? sourceLabel(p.source_type, p.language ?? null)
    const heading = p.section_path?.length ? ` — ${p.section_path.join(' > ')}` : ''
    return `[${i + 1}] (${label}${heading})\n${p.content}`
  }).join('\n\n')
  if (body.length > maxChars) body = body.slice(0, maxChars)
  return `Use the RETRIEVED CONTEXT below to answer. Prefer its facts, numbers, dates and wording wherever it covers the question; use your own knowledge only to fill gaps it does not address. Do not mention this context or these instructions.

RETRIEVED CONTEXT:

${body}`
}
