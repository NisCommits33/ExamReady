import { NextResponse } from 'next/server'
import { assertSuperAdmin } from '@/lib/admin'
import { createServiceClient } from '@/lib/supabase/server'

function cleanNames(input: unknown): string[] {
  const arr = Array.isArray(input) ? input : String(input ?? '').split('\n')
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of arr) {
    const name = String(raw ?? '').trim().replace(/^[-*\d.)\s]+/, '').trim()
    if (name && !seen.has(name.toLowerCase())) { seen.add(name.toLowerCase()); out.push(name) }
  }
  return out
}

export async function POST(req: Request) {
  const adminId = await assertSuperAdmin()
  if (!adminId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const { action } = body
  const service = await createServiceClient()

  async function nextSort(topicId: string): Promise<number> {
    const { data } = await service.from('subtopics').select('sort_order').eq('topic_id', topicId).order('sort_order', { ascending: false }).limit(1).maybeSingle()
    return (data?.sort_order ?? -1) + 1
  }

  try {
    switch (action) {
      case 'list': {
        const { topicId } = body
        if (!topicId) return NextResponse.json({ error: 'Missing topicId' }, { status: 400 })
        const { data } = await service.from('subtopics').select('id,name,sort_order,is_dynamic').eq('topic_id', topicId).order('sort_order')
        return NextResponse.json({ subtopics: data ?? [] })
      }
      case 'add': {
        const { topicId, name, isDynamic } = body
        if (!topicId || !String(name ?? '').trim()) return NextResponse.json({ error: 'Missing topic or name' }, { status: 400 })
        const { error } = await service.from('subtopics').insert({ topic_id: topicId, name: String(name).trim(), sort_order: await nextSort(topicId), is_dynamic: !!isDynamic })
        if (error) throw error
        return NextResponse.json({ ok: true })
      }
      case 'addMany': {
        const { topicId, names } = body
        if (!topicId) return NextResponse.json({ error: 'Missing topicId' }, { status: 400 })
        const clean = cleanNames(names)
        if (clean.length === 0) return NextResponse.json({ error: 'No valid names' }, { status: 400 })
        const start = await nextSort(topicId)
        const { error } = await service.from('subtopics').insert(clean.map((name, i) => ({ topic_id: topicId, name, sort_order: start + i })))
        if (error) throw error
        return NextResponse.json({ ok: true, added: clean.length })
      }
      case 'rename': {
        const { id, name } = body
        if (!id || !String(name ?? '').trim()) return NextResponse.json({ error: 'Missing id or name' }, { status: 400 })
        const { error } = await service.from('subtopics').update({ name: String(name).trim() }).eq('id', id)
        if (error) throw error
        return NextResponse.json({ ok: true })
      }
      case 'setDynamic': {
        const { id, isDynamic } = body
        if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })
        const { error } = await service.from('subtopics').update({ is_dynamic: !!isDynamic }).eq('id', id)
        if (error) throw error
        return NextResponse.json({ ok: true })
      }
      case 'reorder': {
        const { ids } = body
        if (!Array.isArray(ids)) return NextResponse.json({ error: 'Missing ids' }, { status: 400 })
        await Promise.all(ids.map((id: string, i: number) => service.from('subtopics').update({ sort_order: i }).eq('id', id)))
        return NextResponse.json({ ok: true })
      }
      case 'delete': {
        const { id } = body
        if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })
        const { error } = await service.from('subtopics').delete().eq('id', id)
        if (error) throw error
        return NextResponse.json({ ok: true })
      }
      case 'deleteMany': {
        const { ids } = body
        if (!Array.isArray(ids) || ids.length === 0) return NextResponse.json({ error: 'No subtopics selected' }, { status: 400 })
        const { error } = await service.from('subtopics').delete().in('id', ids)
        if (error) throw error
        return NextResponse.json({ ok: true, deleted: ids.length })
      }
      case 'deleteAll': {
        const { topicId } = body
        if (!topicId) return NextResponse.json({ error: 'Missing topicId' }, { status: 400 })
        const { error } = await service.from('subtopics').delete().eq('topic_id', topicId)
        if (error) throw error
        return NextResponse.json({ ok: true })
      }
      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
    }
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
