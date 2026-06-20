'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Brain, Globe, Flame, Hash, BarChart3, BookOpen, Shield } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { NavSection } from './Shell'

const KIND_ICON: Record<string, typeof Home> = { mcq_study: Globe, aptitude: Brain, written: Flame }

export function BottomNav({ sections = [], isSuperAdmin = false }: { sections?: NavSection[]; isSuperAdmin?: boolean }) {
  const pathname = usePathname()

  const sectionNav = sections.slice(0, 3).map(s => ({ href: `/s/${s.id}`, label: s.name.split(' ')[0], Icon: KIND_ICON[s.kind] ?? BookOpen }))
  // Super admins are not students — they only get the Admin view.
  const NAV = isSuperAdmin
    ? [{ href: '/admin', label: 'Admin', Icon: Shield }]
    : [
        { href: '/',        label: 'Home',    Icon: Home      },
        ...sectionNav,
        { href: '/numbers', label: 'Numbers', Icon: Hash      },
        { href: '/progress', label: 'Stats', Icon: BarChart3 },
      ]

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-[#0D1117] border-t border-gray-200 dark:border-[#30363D] safe-bottom md:hidden">
      <div className="flex items-stretch h-14">
        {NAV.map(({ href, label, Icon }) => {
          const active = pathname === href || (href !== '/' && pathname.startsWith(href))
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex-1 flex flex-col items-center justify-center gap-0.5 min-w-0',
                'transition-colors duration-150 active:scale-95',
                active ? 'text-brand-600' : 'text-gray-400 dark:text-gray-600 hover:text-gray-600 dark:hover:text-gray-400'
              )}
            >
              <Icon size={20} strokeWidth={active ? 2.2 : 1.8} />
              <span className={cn('text-[9px] font-medium leading-none truncate', active ? 'text-brand-600' : 'text-gray-400 dark:text-gray-600')}>
                {label}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
