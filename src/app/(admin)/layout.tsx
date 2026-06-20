import { requireSuperAdmin } from '@/lib/admin'
import { createClient } from '@/lib/supabase/server'
import { AdminShell } from '@/components/admin/AdminShell'
import { ConfirmProvider } from '@/components/ui/ConfirmDialog'

export default async function AdminGroupLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireSuperAdmin()
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <ConfirmProvider>
      <AdminShell name={profile?.full_name ?? ''} email={user?.email ?? ''}>
        {children}
      </AdminShell>
    </ConfirmProvider>
  )
}
