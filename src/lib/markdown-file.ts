export function isMarkdownFile(file: File): boolean {
  const name = file.name.toLowerCase()
  return name.endsWith('.md') || name.endsWith('.markdown') || file.type === 'text/markdown'
}

export async function readMarkdownFile(file: File): Promise<string> {
  if (!isMarkdownFile(file)) {
    throw new Error('Please upload a Markdown file (.md)')
  }

  const text = await file.text()
  if (!text.trim()) {
    throw new Error('Markdown file was empty')
  }

  return text
}
