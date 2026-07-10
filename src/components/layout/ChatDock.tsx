'use client'

import { MessageSquare, Trash2, PanelRightClose } from 'lucide-react'
import { toast } from 'sonner'
import { useChatState, useChatActions } from '@/components/ai/ChatProvider'
import { ChatConversation } from '@/components/ai/ChatConversation'

/**
 * Desktop (xl+) chat rail pinned to the right edge of the viewport. Rendered by Shell
 * when the chat is `docked`; the topic content reflows to make room. Uses the shared
 * chat thread (scoped to the current topic by TopicDetail via `dock`).
 */
export function ChatDock() {
  const { topicName, messages, streaming } = useChatState()
  const { undock, clear } = useChatActions()
  const isEmpty = messages.length === 0

  return (
    <aside
      aria-label={topicName ? `Ask AI about ${topicName}` : 'Ask AI'}
      className="hidden xl:flex flex-col fixed top-0 right-0 bottom-0 w-[360px] z-30 bg-white dark:bg-[#0D1117] border-l border-gray-200 dark:border-[#30363D]"
    >
      {/* Header */}
      <div className="flex items-center gap-2.5 px-3 py-2.5 border-b border-gray-200 dark:border-[#30363D] flex-shrink-0">
        <div className="w-7 h-7 rounded-lg bg-brand-600 flex items-center justify-center flex-shrink-0">
          <MessageSquare size={14} className="text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 leading-tight">Ask AI</p>
          {topicName && <p className="text-[11px] text-gray-400 truncate leading-tight">{topicName}</p>}
        </div>
        <button
          onClick={() => { clear(); toast('Chat cleared') }}
          disabled={isEmpty || streaming}
          aria-label="Clear conversation"
          title="Clear conversation"
          className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-[#1C2128] text-gray-400 transition-colors disabled:opacity-30"
        >
          <Trash2 size={15} />
        </button>
        <button
          onClick={undock}
          aria-label="Hide chat"
          title="Hide chat"
          className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-[#1C2128] text-gray-400 transition-colors"
        >
          <PanelRightClose size={16} />
        </button>
      </div>

      <ChatConversation variant="inline" />
    </aside>
  )
}
