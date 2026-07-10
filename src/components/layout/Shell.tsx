'use client'

import { useState } from 'react'
import { Sidebar } from './Sidebar'
import { BottomNav } from './BottomNav'
import { AnnouncementBanner, type BannerAnnouncement } from './AnnouncementBanner'
import { SessionLogSheet } from '@/components/sessions/SessionLogSheet'
import { Toaster } from '@/components/ui/sonner'
import { ChatProvider, useChatState } from '@/components/ai/ChatProvider'
import { ChatPanel } from '@/components/ai/ChatPanel'
import { ChatDock } from './ChatDock'
import { PomodoroProvider } from '@/components/shared/PomodoroProvider'
import { QuickActionsFab } from './QuickActionsFab'
import { PlusCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface NavSection { id: string; name: string; kind: string }

interface ShellProps {
  children: React.ReactNode
  examName?: string
  sections?: NavSection[]
  isSuperAdmin?: boolean
  announcements?: BannerAnnouncement[]
}

export function Shell(props: ShellProps) {
  return (
    <ChatProvider>
      <PomodoroProvider>
        <ShellBody {...props} />
      </PomodoroProvider>
    </ChatProvider>
  )
}

function ShellBody({ children, examName = 'LOKAI', sections = [], isSuperAdmin = false, announcements = [] }: ShellProps) {
  const [sessionOpen, setSessionOpen] = useState(false)
  const { docked } = useChatState()

  return (
    <div className="min-h-dvh bg-gray-100 dark:bg-[#0D1117]">
      <Sidebar onLogSession={() => setSessionOpen(true)} examName={examName} sections={sections} isSuperAdmin={isSuperAdmin} />

      {/* Reserve room for the docked chat rail on xl so content reflows instead of hiding behind it. */}
      <main className={cn('md:ml-60 min-h-dvh pb-16 md:pb-0 transition-[margin] duration-200', docked && 'xl:mr-[360px]')}>
        <div className="max-w-[1080px] mx-auto px-4 md:px-8 py-6">
          <AnnouncementBanner announcements={announcements} />
          {children}
        </div>
      </main>

      <BottomNav sections={sections} isSuperAdmin={isSuperAdmin} />

      {/* Mobile FAB — log session, sits above bottom nav (students only) */}
      {!isSuperAdmin && (
        <button
          onClick={() => setSessionOpen(true)}
          className="fixed bottom-[72px] right-4 z-40 md:hidden w-12 h-12 rounded-full bg-brand-600 text-white shadow-lg flex items-center justify-center hover:bg-brand-800 active:scale-95 transition-all duration-150"
          title="Log session"
        >
          <PlusCircle size={22} strokeWidth={2} />
        </button>
      )}

      {/* Shared chat: mobile/tablet drawer + desktop docked rail */}
      <ChatPanel />
      {!isSuperAdmin && docked && <ChatDock />}

      {/* Combined Ask AI + Pomodoro timer control (students only) */}
      {!isSuperAdmin && <QuickActionsFab docked={docked} />}

      {!isSuperAdmin && <SessionLogSheet open={sessionOpen} onOpenChange={setSessionOpen} />}

      <Toaster position="top-center" richColors closeButton />
    </div>
  )
}
