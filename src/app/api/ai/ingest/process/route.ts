import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { processRagIngestionJobs } from '@/lib/rag'

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const limit = Math.min(Math.max(Number(body.limit) || 3, 1), 10)
  const service = await createServiceClient()

  try {
    const res = await processRagIngestionJobs(service, limit)
    return NextResponse.json({ ok: true, ...res })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
