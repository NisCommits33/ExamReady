/**
 * Reads an SSE stream from an AI route, invoking `onText` with the accumulating
 * text and capturing the final `{ tokens }` event. Returns the full text + tokens used.
 */
export async function readStream(res: Response, onText?: (full: string) => void): Promise<{ text: string; tokens: number }> {
  const reader = res.body!.getReader()
  const decoder = new TextDecoder()
  let full = ''
  let tokens = 0
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
        const delta = json.choices?.[0]?.delta?.content ?? ''
        if (delta) { full += delta; onText?.(full) }
      } catch {}
    }
  }
  return { text: full, tokens }
}
