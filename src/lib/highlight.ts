/**
 * Text-selection highlighting over rendered Markdown.
 *
 * Highlights are persisted as (text, nth, color) rather than DOM offsets, so they
 * survive re-renders and content regeneration. On mount we re-apply each stored
 * highlight by finding the nth occurrence of its text across the container's text
 * nodes and wrapping that range in <mark> elements.
 */

export interface HighlightColor {
  key: string
  label: string
  /** Tailwind-ish inline styles applied to the <mark>. */
  bg: string
  darkBg: string
}

export const HIGHLIGHT_COLORS: HighlightColor[] = [
  { key: 'yellow', label: 'Yellow', bg: 'rgba(250, 204, 21, 0.4)',  darkBg: 'rgba(250, 204, 21, 0.35)' },
  { key: 'green',  label: 'Green',  bg: 'rgba(74, 222, 128, 0.4)',  darkBg: 'rgba(74, 222, 128, 0.3)'  },
  { key: 'blue',   label: 'Blue',   bg: 'rgba(96, 165, 250, 0.4)',  darkBg: 'rgba(96, 165, 250, 0.3)'  },
  { key: 'pink',   label: 'Pink',   bg: 'rgba(244, 114, 182, 0.4)', darkBg: 'rgba(244, 114, 182, 0.3)' },
]

export function colorFor(key: string | null | undefined): HighlightColor {
  return HIGHLIGHT_COLORS.find(c => c.key === key) ?? HIGHLIGHT_COLORS[0]
}

const MARK_ATTR = 'data-hl-id'

/** CSS selector matching a highlight <mark>. Use to detect clicks on existing highlights. */
export const HL_MARK_SELECTOR = `mark[${MARK_ATTR}]`

/** All text nodes under `root`, in document order, skipping nodes inside existing marks. */
function textNodes(root: HTMLElement): Text[] {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = (node as Text).parentElement
      if (!parent) return NodeFilter.FILTER_REJECT
      // Ignore whitespace-only nodes and anything already wrapped in a highlight mark.
      if (parent.closest(`mark[${MARK_ATTR}]`)) return NodeFilter.FILTER_REJECT
      return NodeFilter.FILTER_ACCEPT
    },
  })
  const nodes: Text[] = []
  let n = walker.nextNode()
  while (n) { nodes.push(n as Text); n = walker.nextNode() }
  return nodes
}

/** Plain text content of the highlightable region (marks flattened back to text). */
export function plainText(root: HTMLElement): string {
  return root.textContent ?? ''
}

/**
 * Given the user's current selection inside `root`, return the selected string and
 * which occurrence (0-based) it is within the container's plain text. Returns null
 * if the selection is empty or lies outside `root`.
 */
export function describeSelection(root: HTMLElement): { text: string; nth: number } | null {
  const sel = window.getSelection()
  if (!sel || sel.isCollapsed || sel.rangeCount === 0) return null
  const range = sel.getRangeAt(0)
  if (!root.contains(range.commonAncestorContainer)) return null
  const text = sel.toString().trim()
  if (text.length < 2) return null

  // Count occurrences of `text` that start before the selection's start offset.
  const pre = range.cloneRange()
  pre.selectNodeContents(root)
  pre.setEnd(range.startContainer, range.startOffset)
  const before = pre.toString()
  let nth = 0
  let idx = before.indexOf(text)
  while (idx !== -1) { nth++; idx = before.indexOf(text, idx + 1) }
  return { text, nth }
}

/** Absolute [start,end) offset of the nth occurrence of `text` in `root`'s plain text, or null. */
function offsetsOf(root: HTMLElement, text: string, nth: number): [number, number] | null {
  const full = plainText(root)
  let idx = full.indexOf(text)
  let count = 0
  while (idx !== -1) {
    if (count === nth) return [idx, idx + text.length]
    count++
    idx = full.indexOf(text, idx + 1)
  }
  return null
}

/** Wrap the character span [start,end) of `root` in <mark> elements carrying `id`/color. */
function wrapRange(root: HTMLElement, start: number, end: number, color: HighlightColor, id: string, dark: boolean) {
  // Collect every text node's overlapping sub-range up front. Wrapping a text node
  // splits only that node, leaving the other collected node references valid.
  const targets: { node: Text; from: number; to: number }[] = []
  let cursor = 0
  for (const node of textNodes(root)) {
    const len = node.data.length
    const nodeStart = cursor
    cursor += len
    if (cursor <= start || nodeStart >= end) continue // no overlap
    targets.push({ node, from: Math.max(0, start - nodeStart), to: Math.min(len, end - nodeStart) })
  }
  for (const { node, from, to } of targets) {
    const range = document.createRange()
    range.setStart(node, from)
    range.setEnd(node, to)
    const mark = document.createElement('mark')
    mark.setAttribute(MARK_ATTR, id)
    mark.style.backgroundColor = dark ? color.darkBg : color.bg
    mark.style.borderRadius = '2px'
    mark.style.color = 'inherit'
    mark.style.cursor = 'pointer'
    try {
      range.surroundContents(mark)
    } catch {
      // Range straddled an element boundary — skip this fragment safely.
    }
  }
}

export interface StoredHighlight {
  id: string
  text: string
  nth: number
  color: string | null
}

/** Remove all highlight <mark> wrappers, restoring plain text nodes. */
export function clearHighlights(root: HTMLElement) {
  root.querySelectorAll(`mark[${MARK_ATTR}]`).forEach(mark => {
    const parent = mark.parentNode
    if (!parent) return
    while (mark.firstChild) parent.insertBefore(mark.firstChild, mark)
    parent.removeChild(mark)
    parent.normalize()
  })
}

/** Re-apply the given highlights to `root`. Clears any existing marks first. */
export function applyHighlights(root: HTMLElement, highlights: StoredHighlight[], dark: boolean) {
  clearHighlights(root)
  for (const h of highlights) {
    const range = offsetsOf(root, h.text, h.nth)
    if (!range) continue
    wrapRange(root, range[0], range[1], colorFor(h.color), h.id, dark)
  }
}
