'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { useConfirm, type ConfirmOptions } from '@/components/ui/ConfirmDialog'

interface Props {
  userId: string
  currentRole: string
  isSelf: boolean
  enrollmentActive: boolean | null
  tokenAllocation: number | null
}

const ROLES = ['learner', 'org_admin', 'super_admin']

export function AdminUserActions({ userId, currentRole, isSelf, enrollmentActive, tokenAllocation }: Props) {
  const router = useRouter()
  const confirm = useConfirm()
  const [busy, setBusy] = useState<string | null>(null)
  const [role, setRole] = useState(currentRole)
  const [alloc, setAlloc] = useState(tokenAllocation ? String(tokenAllocation) : '')
  const [confirmDelete, setConfirmDelete] = useState('')

  async function call(action: string, body: Record<string, unknown>, label: string, confirmOpts?: ConfirmOptions) {
    if (confirmOpts && !(await confirm(confirmOpts))) return false
    setBusy(action)
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, userId, ...body }),
      })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error ?? 'Action failed'); return false }
      toast.success(label)
      router.refresh()
      return true
    } catch {
      toast.error('Action failed')
      return false
    } finally {
      setBusy(null)
    }
  }

  return (
    <section className="bg-white dark:bg-[#161B22] border border-gray-200 dark:border-[#30363D] rounded-xl p-5 mb-4">
      <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-4">Admin actions</p>

      <div className="space-y-4">
        {/* Role */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600 dark:text-gray-400 flex-1">Role</span>
          <select
            value={role}
            onChange={e => setRole(e.target.value)}
            disabled={busy !== null}
            className="text-sm border border-gray-200 dark:border-[#30363D] dark:bg-[#1C2128] dark:text-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand-400/30"
          >
            {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
          <button
            onClick={() => call('setRole', { role }, 'Role updated', { title: 'Change role?', message: `Set this user's role to "${role}".`, confirmLabel: 'Change role' })}
            disabled={busy !== null || role === currentRole}
            className="text-xs font-medium text-white bg-brand-600 px-3 py-1.5 rounded-lg hover:bg-brand-800 transition-colors disabled:opacity-40"
          >
            {busy === 'setRole' ? <Loader2 size={13} className="animate-spin" /> : 'Save'}
          </button>
        </div>

        {/* Token allocation */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600 dark:text-gray-400 flex-1">Tokens / month</span>
          <input
            type="number"
            min={0}
            value={alloc}
            onChange={e => setAlloc(e.target.value)}
            disabled={busy !== null}
            placeholder="Unlimited"
            className="w-28 text-sm border border-gray-200 dark:border-[#30363D] dark:bg-[#1C2128] dark:text-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand-400/30"
          />
          <button
            onClick={() => call('setAllocation', { allocation: alloc.trim() === '' ? 0 : Number(alloc) }, 'Allocation updated', { title: 'Update allocation?', message: alloc.trim() === '' ? 'Set this user to unlimited tokens.' : `Set the monthly limit to ${Number(alloc).toLocaleString()} tokens.`, confirmLabel: 'Update' })}
            disabled={busy !== null || alloc === (tokenAllocation ? String(tokenAllocation) : '')}
            className="text-xs font-medium text-white bg-brand-600 px-3 py-1.5 rounded-lg hover:bg-brand-800 transition-colors disabled:opacity-40"
          >
            {busy === 'setAllocation' ? <Loader2 size={13} className="animate-spin" /> : 'Save'}
          </button>
        </div>

        {/* Enrollment */}
        {enrollmentActive !== null && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600 dark:text-gray-400 flex-1">
              Enrollment {enrollmentActive ? '· active' : '· inactive'}
            </span>
            <button
              onClick={() => call('toggleEnrollment', { active: !enrollmentActive }, enrollmentActive ? 'Enrollment deactivated' : 'Enrollment activated', { title: enrollmentActive ? 'Deactivate enrollment?' : 'Activate enrollment?', message: enrollmentActive ? 'The user will lose access to their exam content.' : 'The user will regain access to their exam content.', confirmLabel: enrollmentActive ? 'Deactivate' : 'Activate', danger: enrollmentActive })}
              disabled={busy !== null}
              className="text-xs font-medium border border-gray-200 dark:border-[#30363D] text-gray-700 dark:text-gray-300 px-3 py-1.5 rounded-lg hover:bg-gray-50 dark:hover:bg-[#1C2128] transition-colors disabled:opacity-40"
            >
              {busy === 'toggleEnrollment' ? <Loader2 size={13} className="animate-spin" /> : enrollmentActive ? 'Deactivate' : 'Activate'}
            </button>
          </div>
        )}

        {/* Reset onboarding */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600 dark:text-gray-400 flex-1">Onboarding</span>
          <button
            onClick={() => call('resetOnboarding', {}, 'Onboarding reset', { title: 'Reset onboarding?', message: 'The user will be sent through the onboarding wizard again on next login.', confirmLabel: 'Reset', danger: true })}
            disabled={busy !== null}
            className="text-xs font-medium border border-gray-200 dark:border-[#30363D] text-gray-700 dark:text-gray-300 px-3 py-1.5 rounded-lg hover:bg-gray-50 dark:hover:bg-[#1C2128] transition-colors disabled:opacity-40"
          >
            {busy === 'resetOnboarding' ? <Loader2 size={13} className="animate-spin" /> : 'Reset'}
          </button>
        </div>

        {/* Delete */}
        {!isSelf && (
          <div className="pt-3 border-t border-gray-100 dark:border-[#21262D]">
            <p className="text-xs text-gray-400 mb-2">
              Permanently delete this user and <strong>all</strong> their data. Type <span className="font-mono text-red-600">DELETE</span> to confirm.
            </p>
            <div className="flex items-center gap-2">
              <input
                value={confirmDelete}
                onChange={e => setConfirmDelete(e.target.value)}
                placeholder="DELETE"
                className="flex-1 text-sm border border-gray-200 dark:border-[#30363D] dark:bg-[#1C2128] dark:text-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-red-400/30"
              />
              <button
                onClick={async () => { if (await call('deleteUser', {}, 'User deleted')) router.push('/admin') }}
                disabled={busy !== null || confirmDelete !== 'DELETE'}
                className={cn('flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors disabled:opacity-40',
                  'text-white bg-red-600 hover:bg-red-700')}
              >
                {busy === 'deleteUser' ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />} Delete
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
