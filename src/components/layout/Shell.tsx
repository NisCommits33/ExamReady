'use client'

import { useState } from 'react'
import { Sidebar } from './Sidebar'
import { BottomNav } from './BottomNav'
import { SessionLogSheet } from '@/components/sessions/SessionLogSheet'
import { Toaster } from '@/components/ui/sonner'
import { PlusCircle } from 'lucide-react'

export interface NavSection { id: string; name: string; kind: string }

export function Shell({ children, examName, sections }: { children: React.ReactNode; examName?: string; sections?: NavSection[] }) {
  const [sessionOpen, setSessionOpen] = useState(false)

  return (
    <div className="min-h-dvh bg-gray-100 dark:bg-[#0D1117]">
      <Sidebar onLogSession={() => setSessionOpen(true)} examName={examName} sections={sections} />

      <main className="md:ml-60 min-h-dvh pb-16 md:pb-0">
        <div className="max-w-[1080px] mx-auto px-4 md:px-8 py-6">
          {children}
        </div>
      </main>

      <BottomNav sections={sections} />

      {/* Mobile FAB — log session, sits above bottom nav */}
      <button
        onClick={() => setSessionOpen(true)}
        className="fixed bottom-[72px] right-4 z-40 md:hidden w-12 h-12 rounded-full bg-brand-600 text-white shadow-lg flex items-center justify-center hover:bg-brand-800 active:scale-95 transition-all duration-150"
        title="Log session"
      >
        <PlusCircle size={22} strokeWidth={2} />
      </button>

      <SessionLogSheet open={sessionOpen} onOpenChange={setSessionOpen} />

      <Toaster position="top-center" richColors closeButton />
    </div>
  )
}
