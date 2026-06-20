/** True for Markdown / plain-text files we can read directly in the browser (no OCR). */
export function isTextFile(file: File): boolean {
  return /\.(md|markdown|txt)$/i.test(file.name) || file.type.startsWith('text/')
}

/** Send an image/PDF to the OCR route and return the extracted text (throws with the server message on failure). */
export async function extractFile(file: File): Promise<string> {
  const form = new FormData()
  form.append('file', file)
  const res = await fetch('/api/ai/extract-source', { method: 'POST', body: form })
  const json = await res.json().catch(() => ({}))
  if (!res.ok || !json.text) throw new Error(json.error ?? 'Could not extract text')
  return json.text as string
}

/** Read any supported source file → text: direct for md/txt, OCR for image/pdf. */
export async function readSourceFile(file: File): Promise<string> {
  return isTextFile(file) ? file.text() : extractFile(file)
}
