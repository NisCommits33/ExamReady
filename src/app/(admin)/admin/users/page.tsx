import { getUsersOverview } from '@/lib/admin'
import { AdminUsersClient } from '@/components/admin/AdminUsersClient'

export const dynamic = 'force-dynamic'

export default async function AdminUsersPage() {
  const users = await getUsersOverview()
  return <AdminUsersClient users={users} />
}
