import { NextResponse } from 'next/server'
import { assertSuperAdmin } from '@/lib/admin'
import { createServiceClient } from '@/lib/supabase/server'

const ROLES = ['learner', 'org_admin', 'super_admin']

export async function POST(req: Request) {
  const adminId = await assertSuperAdmin()
  if (!adminId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { action, userId, role, active, allocation } = await req.json()
  if (!action || !userId) return NextResponse.json({ error: 'Missing action or userId' }, { status: 400 })

  const service = await createServiceClient()

  try {
    switch (action) {
      case 'setRole': {
        if (!ROLES.includes(role)) return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
        if (userId === adminId && role !== 'super_admin') {
          return NextResponse.json({ error: "You can't remove your own admin role" }, { status: 400 })
        }
        const { error } = await service.from('profiles').update({ role }).eq('id', userId)
        if (error) throw error
        return NextResponse.json({ ok: true })
      }
      case 'setAllocation': {
        const n = Number(allocation)
        const value = Number.isFinite(n) && n > 0 ? Math.floor(n) : null
        const { error } = await service.from('profiles').update({ token_allocation: value }).eq('id', userId)
        if (error) throw error
        return NextResponse.json({ ok: true })
      }
      case 'resetOnboarding': {
        const { error } = await service.from('profiles').update({ onboarded: false }).eq('id', userId)
        if (error) throw error
        return NextResponse.json({ ok: true })
      }
      case 'toggleEnrollment': {
        const { error } = await service.from('enrollments').update({ is_active: !!active }).eq('user_id', userId)
        if (error) throw error
        return NextResponse.json({ ok: true })
      }
      case 'deleteUser': {
        if (userId === adminId) return NextResponse.json({ error: "You can't delete your own account" }, { status: 400 })
        const { error } = await service.auth.admin.deleteUser(userId)
        if (error) throw error
        return NextResponse.json({ ok: true })
      }
      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
    }
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
