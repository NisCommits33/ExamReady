import { createHash } from 'crypto'
import type { createClient } from '@/lib/supabase/server'

type ServerClient = Awaited<ReturnType<typeof createClient>>
export type TransformMode = 'simplify' | 'elaborate'

export interface CachedTransform {
  output: string
  sources: { title: string; uri: string }[]
  web: boolean
}

/** Stable hash of the input text — changes when the source content changes, invalidating the cache. */
export function hashContent(text: string): string {
  return createHash('sha256').update(text).digest('hex')
}

/** Returns a previously stored transform for this content+mode, or null on a cache miss. */
export async function getCachedTransform(
  supabase: ServerClient,
  contentHash: string,
  mode: TransformMode,
): Promise<CachedTransform | null> {
  const { data } = await supabase
    .from('ai_transforms')
    .select('output,sources,web')
    .eq('content_hash', contentHash)
    .eq('mode', mode)
    .maybeSingle()
  if (!data?.output) return null
  return {
    output: data.output,
    sources: (data.sources as { title: string; uri: string }[]) ?? [],
    web: !!data.web,
  }
}

/** Persists a transform result (best-effort; failures are swallowed so generation still succeeds). */
export async function saveTransform(
  supabase: ServerClient,
  contentHash: string,
  mode: TransformMode,
  output: string,
  opts: { sources?: { title: string; uri: string }[]; web?: boolean; topicName?: string } = {},
): Promise<void> {
  try {
    await supabase.from('ai_transforms').upsert(
      {
        content_hash: contentHash,
        mode,
        output,
        sources: opts.sources ?? [],
        web: opts.web ?? false,
        topic_name: opts.topicName ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'content_hash,mode' },
    )
  } catch {
    // non-critical: caching is an optimisation, never block the response
  }
}
