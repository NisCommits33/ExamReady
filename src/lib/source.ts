import type { createClient } from '@/lib/supabase/server'

type ServerClient = Awaited<ReturnType<typeof createClient>>

const MAX_SOURCE_CHARS = 6000

/**
 * Loads the source material for a topic, combining the user-uploaded source
 * (`official_source_2`) and the original `official_source`, with the user's
 * source prioritised first. Returns null if neither exists.
 */
export async function getTopicSource(supabase: ServerClient, topicId: string): Promise<string | null> {
  const { data } = await supabase
    .from('topic_notes')
    .select('official_source,official_source_2')
    .eq('topic_id', topicId)
    .maybeSingle()

  const combined = [data?.official_source_2, data?.official_source]
    .map(s => s?.trim())
    .filter(Boolean)
    .join('\n\n---\n\n')

  return combined || null
}

/** Prompt fragment instructing the model to ground its output in the given source. */
export function sourceGroundingBlock(text: string): string {
  return `Ground your output in the SOURCE MATERIAL below. Prefer its facts, numbers, dates and wording wherever it covers the topic; use your own knowledge only to fill gaps it does not address.

SOURCE MATERIAL:

${text.slice(0, MAX_SOURCE_CHARS)}`
}
