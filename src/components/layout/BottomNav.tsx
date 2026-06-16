'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, BookOpen, Brain, Globe, Flame, BarChart3 } from 'lucide-react'
import { cn } from '@/lib/utils'

const NAV = [
  { href: '/',       label: 'Home',    Icon: Home      },
  { href: '/topics', label: 'Topics',  Icon: BookOpen  },
  { href: '/iq',     label: 'IQ',      Icon: Brain     },
  { href: '/gk',     label: 'GK',      Icon: Globe     },
  { href: '/arff',   label: 'ARFF',    Icon: Flame     },
  { href: '/progress', label: 'Progress', Icon: BarChart3 },
]

export function BottomNav() {
  const pathname = usePathname()

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
              <span className={cn(
                'text-[9px] font-medium leading-none truncate',
                active ? 'text-brand-600' : 'text-gray-400 dark:text-gray-600'
              )}>
                {label}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
