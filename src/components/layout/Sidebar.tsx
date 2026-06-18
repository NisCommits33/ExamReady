'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Home, Brain, Globe, Flame, Calendar, BarChart3, PlusCircle, LogOut, Hash, BookOpen, User } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ThemeToggle } from '@/components/ui/ThemeToggle'
import { ExamCountdown } from '@/components/shared/ExamCountdown'
import type { NavSection } from './Shell'

const KIND_ICON: Record<string, typeof Home> = { mcq_study: Globe, aptitude: Brain, written: Flame }

interface SidebarProps {
  onLogSession?: () => void
  examName?: string
  sections?: NavSection[]
}

export function Sidebar({ onLogSession, examName = 'ExamReady', sections = [] }: SidebarProps) {
  const sectionNav = sections.map(s => ({ href: `/s/${s.id}`, label: s.name, Icon: KIND_ICON[s.kind] ?? BookOpen }))
  const NAV = [
    { href: '/',          label: 'Home',        Icon: Home      },
    ...sectionNav,
    { href: '/numbers',   label: 'Key Numbers', Icon: Hash      },
    { href: '/timetable', label: 'Timetable',   Icon: Calendar  },
    { href: '/progress',  label: 'Progress',    Icon: BarChart3 },
  ]
  const pathname = usePathname()
  const router = useRouter()
  const [signingOut, setSigningOut] = useState(false)

  async function handleSignOut() {
    setSigningOut(true)
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <aside className="hidden md:flex flex-col w-60 h-screen fixed left-0 top-0 bg-white dark:bg-[#0D1117] border-r border-gray-200 dark:border-[#30363D] z-40">
      {/* Logo + theme toggle */}
      <div className="px-5 py-4 border-b border-gray-100 dark:border-[#30363D] flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center flex-shrink-0">
            <span className="text-white text-xs font-bold">ER</span>
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 leading-tight">ExamReady</p>
            <p className="text-[11px] text-gray-400 leading-tight truncate max-w-[140px]">{examName}</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Link
            href="/profile"
            aria-label="Profile"
            className={cn(
              'p-1.5 rounded-lg transition-colors',
              pathname === '/profile' ? 'bg-brand-50 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400' : 'hover:bg-gray-100 dark:hover:bg-[#1C2128] text-gray-400'
            )}
          >
            <User size={16} />
          </Link>
          <ThemeToggle />
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
        {NAV.map(({ href, label, Icon }) => {
          const active = pathname === href || (href !== '/' && pathname.startsWith(href))
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150',
                active
                  ? 'bg-brand-50 dark:bg-brand-900/30 text-brand-800 dark:text-brand-400'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-[#1C2128] hover:text-gray-900 dark:hover:text-gray-200'
              )}
            >
              <Icon size={17} strokeWidth={active ? 2.2 : 1.8} className="flex-shrink-0" />
              {label}
            </Link>
          )
        })}
      </nav>

      {/* Bottom */}
      <div className="px-3 pb-4 border-t border-gray-100 dark:border-[#30363D] pt-3 space-y-2">
        <ExamCountdown compact />

        <button
          onClick={onLogSession}
          className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium bg-brand-600 text-white hover:bg-brand-800 transition-colors duration-150"
        >
          <PlusCircle size={16} strokeWidth={2} />
          Log session
        </button>

        <button
          onClick={handleSignOut}
          disabled={signingOut}
          className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-[#1C2128] hover:text-gray-700 dark:hover:text-gray-200 transition-colors duration-150 disabled:opacity-50"
        >
          <LogOut size={16} strokeWidth={1.8} />
          {signingOut ? 'Signing out…' : 'Sign out'}
        </button>
      </div>
    </aside>
  )
}
