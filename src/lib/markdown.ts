/**
 * Splits a markdown document into sections at its primary heading level.
 * Each section = { name (heading text), content (heading + body, incl. deeper headings) }.
 * Prefers `##` as the split level, then `#`, then `###`. Preamble before the first
 * heading is ignored.
 */
export function splitSourceSections(md: string): { name: string; content: string }[] {
  const lines = (md ?? '').split(/\r?\n/)
  const headingLevel = (l: string) => { const m = l.match(/^(#{1,4})\s+/); return m ? m[1].length : 0 }
  const present = new Set(lines.map(headingLevel).filter(Boolean))
  const splitLv = present.has(2) ? 2 : present.has(1) ? 1 : present.has(3) ? 3 : present.has(4) ? 4 : 0
  if (!splitLv) return []

  const sections: { name: string; content: string }[] = []
  let cur: { name: string; content: string } | null = null
  for (const line of lines) {
    const m = line.match(/^(#{1,4})\s+(.+?)\s*$/)
    if (m && m[1].length === splitLv) {
      if (cur) sections.push(cur)
      cur = { name: m[2].replace(/[*_`#]/g, '').trim(), content: line + '\n' }
    } else if (cur) {
      cur.content += line + '\n'
    }
  }
  if (cur) sections.push(cur)

  return sections
    .map(s => ({ name: s.name, content: s.content.trim() }))
    .filter(s => s.name && s.name.length <= 80)
}
