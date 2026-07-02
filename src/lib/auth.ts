import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { User } from '@supabase/supabase-js'

/**
 * Require an authenticated user for an API route.
 * Returns `{ user }` when signed in, or `{ response }` = a 401 to return immediately.
 *
 *   const { user, response } = await requireUser()
 *   if (response) return response
 */
export async function requireUser(): Promise<{ user: User | null; response: NextResponse | null }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { user: null, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  return { user, response: null }
}
