'use client'

import { useState } from 'react'
import { Sidebar } from './Sidebar'
import { BottomNav } from './BottomNav'
import { AnnouncementBanner, type BannerAnnouncement } from './AnnouncementBanner'
import { SessionLogSheet } from '@/components/sessions/SessionLogSheet'
import { PomodoroTimer } from '@/components/shared/PomodoroTimer'
import { Toaster } from '@/components/ui/sonner'
import { ChatProvider, useChatActions } from '@/components/ai/ChatProvider'
import { ChatPanel } from '@/components/ai/ChatPanel'
import { PlusCircle, MessageSquare } from 'lucide-react'

export interface NavSection { id: string; name: string; kind: string }

/**
 * Floating global "Ask AI" launcher — opens a general (topic-less) chat.
 * Sits at the top of the FAB stack: above the session FAB (72px) and the
 * Pomodoro FAB (124px) on mobile, and above the Pomodoro FAB on desktop.
 */
function ChatLauncher() {
  const { openChat } = useChatActions()
  return (
    <button
      onClick={() => openChat()}
      aria-label="Ask AI"
      title="Ask AI"
      className="fixed right-4 z-40 bottom-[176px] md:bottom-20 md:right-6 w-12 h-12 rounded-full bg-brand-600 text-white shadow-lg flex items-center justify-center hover:bg-brand-800 active:scale-95 transition-all duration-150"
    >
      <MessageSquare size={20} strokeWidth={2} />
    </button>
  )
}

export function Shell({ children, examName, sections, isSuperAdmin = false, announcements = [] }: { children: React.ReactNode; examName?: string; sections?: NavSection[]; isSuperAdmin?: boolean; announcements?: BannerAnnouncement[] }) {
  const [sessionOpen, setSessionOpen] = useState(false)

  return (
    <ChatProvider>
      <div className="min-h-dvh bg-gray-100 dark:bg-[#0D1117]">
        <Sidebar onLogSession={() => setSessionOpen(true)} examName={examName} sections={sections} isSuperAdmin={isSuperAdmin} />

        <main className="md:ml-60 min-h-dvh pb-16 md:pb-0">
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

        {/* Global "Ask AI" launcher (students only) + shared chat panel (all roles) */}
        {!isSuperAdmin && <ChatLauncher />}
        <ChatPanel />

        {/* Pomodoro focus timer — students only, keeps running across navigation */}
        {!isSuperAdmin && <PomodoroTimer />}

        {!isSuperAdmin && <SessionLogSheet open={sessionOpen} onOpenChange={setSessionOpen} />}

        <Toaster position="top-center" richColors closeButton />
      </div>
    </ChatProvider>
  )
}
