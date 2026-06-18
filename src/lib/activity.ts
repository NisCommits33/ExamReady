import { createClient } from '@/lib/supabase/server'

export async function logActivity(
  action: string,
  topicId?: string | null,
  meta?: Record<string, unknown>
) {
  try {
    const supabase = await createClient()
    await supabase.from('activity_log').insert({
      action,
      topic_id: topicId ?? null,
      meta: meta ?? {},
    })
  } catch {}
}
