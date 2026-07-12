import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { assertSuperAdmin } from '@/lib/admin'
import { ingestTopic } from '@/lib/rag'

/**
 * Embed a topic's content into the RAG index.
 *  - `{ topicId }` — (re)ingest one topic. Any signed-in user (fired after note/annotation/source saves).
 *  - `{ all: true }` — backfill every topic that has content. Super-admins only.
 */
export async function POST(req: Request) {
  const { topicId, all } = await req.json().catch(() => ({}))

  const service = await createServiceClient()

  if (all) {
    const adminId = await assertSuperAdmin()
    if (!adminId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    // Topics that have any embeddable content.
    const [{ data: notes }, { data: adminSrcs }, { data: legacySrcs }, { data: userSrcs }, { data: anns }] = await Promise.all([
      service.from('topic_notes').select('topic_id'),
      service.from('topic_source_files').select('topic_id'),
      service.from('user_topic_sources').select('topic_id'),
      service.from('user_topic_source_files').select('topic_id'),
      service.from('user_annotations').select('topic_id').eq('annotation_type', 'note'),
    ])
    const topicIds = Array.from(new Set([
      ...(notes ?? []).map(n => n.topic_id),
      ...(adminSrcs ?? []).map(s => s.topic_id),
      ...(legacySrcs ?? []).map(s => s.topic_id),
      ...(userSrcs ?? []).map(s => s.topic_id),
      ...(anns ?? []).map(a => a.topic_id),
    ].filter(Boolean))) as string[]

    let inserted = 0
    const errors: string[] = []
    for (const id of topicIds) {
      try { inserted += (await ingestTopic(service, id)).inserted }
      catch (e) { errors.push(e instanceof Error ? e.message : String(e)) }
    }
    return NextResponse.json({ ok: true, topics: topicIds.length, inserted, errors: errors.slice(0, 3) })
  }

  if (!topicId) return NextResponse.json({ error: 'Missing topicId' }, { status: 400 })

  // Single-topic ingest — must be signed in (shared content; annotations keep their owner).
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const res = await ingestTopic(service, topicId)
    return NextResponse.json({ ok: true, ...res })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
