import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export type Provider = 'groq' | 'gemini' | 'openrouter'
/** `tokens` is written back by the AI helpers so the route can report it to the client. */
export interface UsageCtx { action: string; tokens?: number }
export interface TokenUsage { prompt: number; completion: number; total: number }

/**
 * USD per 1,000,000 tokens, per model. Approximate, configurable.
 * `in` = prompt/input tokens, `out` = completion/output tokens.
 */
export const PRICING: Record<string, { in: number; out: number }> = {
  'llama-3.3-70b-versatile':        { in: 0.59, out: 0.79 },
  'gemini-2.0-flash':               { in: 0.10, out: 0.40 },
  'gemini-2.0-flash-thinking-exp':  { in: 0.00, out: 0.00 },
}

/** Estimated USD cost for a single call's token split. */
export function estimateCost(model: string, prompt: number, completion: number): number {
  const p = PRICING[model]
  if (!p) return 0
  return (prompt / 1_000_000) * p.in + (completion / 1_000_000) * p.out
}

/**
 * Best-effort record of token usage for the current user (RLS sets user_id = auth.uid()).
 * Never throws — usage tracking must not break the AI response.
 */
export async function recordUsage(provider: Provider, model: string, action: string, usage: TokenUsage): Promise<void> {
  if (!usage || (usage.total ?? 0) <= 0) return
  try {
    const supabase = await createClient()
    await supabase.from('ai_usage').insert({
      action,
      provider,
      model,
      prompt_tokens: usage.prompt ?? 0,
      completion_tokens: usage.completion ?? 0,
      total_tokens: usage.total ?? 0,
    })
  } catch {
    // non-critical
  }
}

/** ISO date (YYYY-MM-DD) of the first day of the current UTC calendar month. */
export function monthStartISO(): string {
  const d = new Date()
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-01`
}

/** Total tokens a user has consumed in the current calendar month. */
export async function getMonthlyUsage(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
): Promise<number> {
  const { data } = await supabase
    .from('ai_usage')
    .select('total_tokens')
    .eq('user_id', userId)
    .gte('created_at', `${monthStartISO()}T00:00:00Z`)
  return (data ?? []).reduce((s, r) => s + (r.total_tokens ?? 0), 0)
}

/**
 * Enforce the current user's monthly token allocation.
 * Returns a 429 response when over the cap, or null to allow the call
 * (also null for unlimited users or on any internal error — fail open).
 */
export async function quotaGuard(): Promise<NextResponse | null> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null
    const { data: profile } = await supabase.from('profiles').select('token_allocation').eq('id', user.id).maybeSingle()
    const allocation = profile?.token_allocation ?? null
    if (!allocation || allocation <= 0) return null // unlimited
    const used = await getMonthlyUsage(supabase, user.id)
    if (used >= allocation) {
      return NextResponse.json(
        { error: 'Monthly AI token limit reached. Contact your admin.' },
        { status: 429 },
      )
    }
    return null
  } catch {
    return null // fail open — never block on a glitch
  }
}
