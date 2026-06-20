import { toast } from 'sonner'

/** Show a subtle toast with the tokens used by the just-finished AI task. */
export function notifyTokens(n: number | null | undefined): void {
  const v = Number(n) || 0
  if (v > 0) toast(`Used ${v.toLocaleString()} AI tokens`, { duration: 2500 })
}

/** Read the token count a route reported via the X-AI-Tokens response header. */
export function tokensFromRes(res: Response): number {
  return Number(res.headers.get('x-ai-tokens')) || 0
}
