import type { createClient } from '@/lib/supabase/server'
import type { SourceLanguage } from '@/lib/language'

type ServerClient = Awaited<ReturnType<typeof createClient>>

const MAX_SOURCE_CHARS = 6000

/**
 * Loads the source material for a topic, combining the caller's own per-user source
 * and the admin official source for the requested language, with the user's source
 * prioritised first. Legacy single-language content is used only for English fallback.
 *
 * `includeUserSource` must be false when called with a service-role client (RLS is
 * bypassed, so the per-user table isn't scoped to a single user).
 */
export async function getTopicSource(
  supabase: ServerClient,
  topicId: string,
  opts?: { includeUserSource?: boolean; language?: SourceLanguage },
): Promise<string | null> {
  const includeUserSource = opts?.includeUserSource ?? true
  const language = opts?.language ?? 'en'

  let userContent: string | null = null
  if (includeUserSource) {
    const { data: languageSource } = await supabase
      .from('user_topic_source_files')
      .select('content')
      .eq('topic_id', topicId)
      .eq('language', language)
      .maybeSingle()
    userContent = languageSource?.content ?? null

    if (!userContent && language === 'en') {
      const { data } = await supabase
        .from('user_topic_sources')
        .select('content')
        .eq('topic_id', topicId)
        .maybeSingle()
      userContent = data?.content ?? null
    }
  }

  const { data: languageOfficial } = await supabase
    .from('topic_source_files')
    .select('content')
    .eq('topic_id', topicId)
    .eq('language', language)
    .maybeSingle()
  let officialContent = languageOfficial?.content ?? null

  if (!officialContent && language === 'en') {
    const { data: notes } = await supabase
      .from('topic_notes')
      .select('official_source')
      .eq('topic_id', topicId)
      .maybeSingle()
    officialContent = notes?.official_source ?? null
  }

  const combined = [userContent, officialContent]
    .map(s => s?.trim())
    .filter(Boolean)
    .join('\n\n---\n\n')

  return combined || null
}

export type GroundingMode = 'source' | 'note' | 'general'

/**
 * Resolves the grounding text for AI MCQ generation based on the chosen mode.
 * When a subtopic is selected, its own material is preferred over the topic's.
 * Returns null for 'general' (or when no material exists) → pure model knowledge.
 */
export async function getMcqGrounding(
  supabase: ServerClient,
  { topicId, subtopicId, mode, language = 'en' }: { topicId: string; subtopicId?: string | null; mode: GroundingMode; language?: SourceLanguage },
): Promise<string | null> {
  if (mode === 'general') return null

  if (subtopicId) {
    const { data: st } = await supabase
      .from('subtopics')
      .select('official_source,study_note')
      .eq('id', subtopicId)
      .maybeSingle()
    const stText = (mode === 'note' ? st?.study_note : st?.official_source)?.trim()
    if (stText) return stText
  }

  if (mode === 'note') {
    const { data } = await supabase.from('topic_notes').select('study_note').eq('topic_id', topicId).maybeSingle()
    return data?.study_note?.trim() || null
  }
  // mode === 'source'
  return getTopicSource(supabase, topicId, { language })
}

/** Prompt fragment instructing the model to ground its output in the given source. */
export function sourceGroundingBlock(text: string): string {
  return `Ground your output in the SOURCE MATERIAL below. Prefer its facts, numbers, dates and wording wherever it covers the topic; use your own knowledge only to fill gaps it does not address.

SOURCE MATERIAL:

${text.slice(0, MAX_SOURCE_CHARS)}`
}
