/**
 * Reads an SSE stream from an AI route, invoking `onText` with the accumulating
 * text and capturing metadata events such as `{ tokens }` and `{ citations }`.
 */
export interface StreamCitation {
  id: string
  title: string
  sourceType: string
  language?: 'en' | 'ne' | null
  fileName?: string | null
  sectionPath?: string[]
  excerpt: string
}

export async function readStream(
  res: Response,
  onText?: (full: string) => void,
  onMeta?: (meta: { citations?: StreamCitation[] }) => void,
): Promise<{ text: string; tokens: number; citations: StreamCitation[] }> {
  const reader = res.body!.getReader()
  const decoder = new TextDecoder()
  let full = ''
  let tokens = 0
  let citations: StreamCitation[] = []
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    for (const line of decoder.decode(value).split('\n')) {
      if (!line.startsWith('data: ')) continue
      const data = line.slice(6)
      if (data === '[DONE]') break
      try {
        const json = JSON.parse(data)
        if (typeof json.tokens === 'number') tokens = json.tokens
        if (Array.isArray(json.citations)) {
          citations = json.citations
          onMeta?.({ citations })
        }
        const delta = json.choices?.[0]?.delta?.content ?? ''
        if (delta) { full += delta; onText?.(full) }
      } catch {}
    }
  }
  return { text: full, tokens, citations }
}
