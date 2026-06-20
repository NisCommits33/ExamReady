'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard, Users, BarChart3, BookOpen, Megaphone,
  Menu, X, ArrowUpRight, LogOut, Shield,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { ThemeToggle } from '@/components/ui/ThemeToggle'

const NAV = [
  { href: '/admin',               label: 'Dashboard',     Icon: LayoutDashboard, exact: true },
  { href: '/admin/users',         label: 'Users',         Icon: Users,           exact: false },
  { href: '/admin/analytics',     label: 'Analytics',     Icon: BarChart3,       exact: false },
  { href: '/admin/content',       label: 'Content',       Icon: BookOpen,        exact: false },
  { href: '/admin/announcements', label: 'Announcements', Icon: Megaphone,       exact: false },
]

function titleFor(pathname: string): string {
  if (pathname.startsWith('/admin/users')) return 'Users'
  if (pathname.startsWith('/admin/analytics')) return 'Analytics'
  if (pathname.startsWith('/admin/content')) return 'Content'
  if (pathname.startsWith('/admin/announcements')) return 'Announcements'
  return 'Dashboard'
}

export function AdminShell({ name, email, children }: { name: string; email: string; children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [drawer, setDrawer] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const initial = (name || email || '?').trim().charAt(0).toUpperCase()

  async function signOut() {
    setSigningOut(true)
    await createClient().auth.signOut()
    router.push('/login')
  }

  const navList = (
    <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
      {NAV.map(({ href, label, Icon, exact }) => {
        const active = exact ? pathname === href : pathname.startsWith(href)
        return (
          <Link
            key={href}
            href={href}
            onClick={() => setDrawer(false)}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors duration-150 relative',
              active
                ? 'bg-brand-50 dark:bg-brand-900/30 text-brand-800 dark:text-brand-300'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-[#1C2128] hover:text-gray-900 dark:hover:text-gray-200',
            )}
          >
            {active && <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-full bg-brand-600" />}
            <Icon size={17} strokeWidth={active ? 2.2 : 1.8} className="flex-shrink-0" />
            {label}
          </Link>
        )
      })}
    </nav>
  )

  const sidebarInner = (
    <>
      <div className="px-5 py-4 border-b border-gray-100 dark:border-[#21262D] flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center flex-shrink-0">
          <Shield size={16} className="text-white" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 leading-tight">Admin</p>
          <p className="text-[11px] text-gray-400 leading-tight">ExamReady console</p>
        </div>
      </div>

      {navList}

      <div className="px-3 pb-4 border-t border-gray-100 dark:border-[#21262D] pt-3 space-y-1">
        <Link href="/" className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-[#1C2128] hover:text-gray-900 dark:hover:text-gray-200 transition-colors">
          <ArrowUpRight size={16} strokeWidth={1.8} /> Back to app
        </Link>
        <button
          onClick={signOut}
          disabled={signingOut}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-[#1C2128] hover:text-gray-700 dark:hover:text-gray-200 transition-colors disabled:opacity-50"
        >
          <LogOut size={16} strokeWidth={1.8} /> {signingOut ? 'Signing out…' : 'Sign out'}
        </button>
      </div>
    </>
  )

  return (
    <div className="min-h-dvh bg-gray-50 dark:bg-[#0D1117]">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col w-60 h-dvh fixed left-0 top-0 bg-white dark:bg-[#0D1117] border-r border-gray-200 dark:border-[#30363D] z-40">
        {sidebarInner}
      </aside>

      {/* Mobile drawer */}
      {drawer && (
        <div className="md:hidden fixed inset-0 z-50" onClick={() => setDrawer(false)}>
          <div className="absolute inset-0 bg-black/50" />
          <aside className="absolute left-0 top-0 h-dvh w-64 flex flex-col bg-white dark:bg-[#0D1117] border-r border-gray-200 dark:border-[#30363D]" onClick={e => e.stopPropagation()}>
            {sidebarInner}
          </aside>
        </div>
      )}

      <div className="md:ml-60 flex flex-col min-h-dvh">
        {/* Top bar */}
        <header className="sticky top-0 z-30 h-14 flex items-center gap-3 px-4 md:px-6 bg-white/90 dark:bg-[#0D1117]/90 backdrop-blur border-b border-gray-200 dark:border-[#30363D]">
          <button onClick={() => setDrawer(true)} className="md:hidden p-2 -ml-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-[#1C2128]" aria-label="Open menu">
            <Menu size={18} />
          </button>
          <h1 className="text-sm font-semibold text-gray-900 dark:text-gray-100 flex-1 truncate">{titleFor(pathname)}</h1>
          <ThemeToggle />
          <div className="hidden sm:flex items-center gap-2 pl-2 border-l border-gray-200 dark:border-[#30363D]">
            <div className="w-7 h-7 rounded-full bg-brand-600 flex items-center justify-center text-white text-xs font-semibold flex-shrink-0">{initial}</div>
            <span className="text-xs text-gray-600 dark:text-gray-400 max-w-[160px] truncate">{email}</span>
          </div>
        </header>

        <main className="flex-1 p-4 md:p-6">
          <div className="max-w-7xl mx-auto">{children}</div>
        </main>
      </div>

      {/* Close drawer button (mobile, when open) */}
      {drawer && (
        <button onClick={() => setDrawer(false)} className="md:hidden fixed top-3 right-3 z-[60] p-2 rounded-lg bg-white dark:bg-[#161B22] border border-gray-200 dark:border-[#30363D] text-gray-500" aria-label="Close menu">
          <X size={18} />
        </button>
      )}
    </div>
  )
}
