/** Compact token count, e.g. 1234 → "1.2k", 2_500_000 → "2.50M". */
export function fmtTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return String(n)
}

/** USD cost with adaptive precision. */
export function fmtCost(n: number): string {
  return `$${n < 1 ? n.toFixed(4) : n.toFixed(2)}`
}
