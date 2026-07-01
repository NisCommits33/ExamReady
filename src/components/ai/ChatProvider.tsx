'use client'

import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'
import { readStream } from '@/lib/sse'
import { notifyTokens } from '@/lib/notify-tokens'

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

/** Data that changes as the conversation streams — consume only where it's rendered. */
interface ChatStateValue {
  open: boolean
  topicId?: string
  topicName?: string
  messages: ChatMessage[]
  streaming: boolean
}

/** Stable callbacks — never change identity, so consumers don't re-render on stream updates. */
interface ChatActions {
  openChat: (topicId?: string, topicName?: string) => void
  closeChat: () => void
  clear: () => void
  send: (text: string) => void
  stop: () => void
  regenerate: () => void
}

const ChatStateContext = createContext<ChatStateValue | null>(null)
const ChatActionsContext = createContext<ChatActions | null>(null)

/** Full chat state — for the panel that renders the conversation. */
export function useChatState(): ChatStateValue {
  const ctx = useContext(ChatStateContext)
  if (!ctx) throw new Error('useChatState must be used inside <ChatProvider>')
  return ctx
}

/**
 * Chat actions only (openChat, closeChat, …). Use this in triggers so they don't
 * re-render while the conversation streams.
 */
export function useChatActions(): ChatActions {
  const ctx = useContext(ChatActionsContext)
  if (!ctx) throw new Error('useChatActions must be used inside <ChatProvider>')
  return ctx
}

const ERROR_MESSAGE = 'Sorry, something went wrong. Please try again.'

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const [topicId, setTopicId] = useState<string | undefined>(undefined)
  const [topicName, setTopicName] = useState<string | undefined>(undefined)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [streaming, setStreaming] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  // Mirror of `messages` so callbacks can read the latest thread without re-binding.
  const messagesRef = useRef<ChatMessage[]>([])
  // The element that had focus when the panel opened, so we can restore it on close.
  const triggerRef = useRef<HTMLElement | null>(null)
  // Latest topicId for the streaming request, avoiding stale closures.
  const topicIdRef = useRef<string | undefined>(undefined)

  const commit = useCallback((msgs: ChatMessage[]) => {
    messagesRef.current = msgs
    setMessages(msgs)
  }, [])

  const openChat = useCallback((nextTopicId?: string, nextTopicName?: string) => {
    triggerRef.current = (document.activeElement as HTMLElement) ?? null
    // Switching topics (or between topic-scoped and general) starts a fresh thread.
    if (topicIdRef.current !== nextTopicId) commit([])
    topicIdRef.current = nextTopicId
    setTopicId(nextTopicId)
    setTopicName(nextTopicName)
    setOpen(true)
  }, [commit])

  const closeChat = useCallback(() => {
    setOpen(false)
    triggerRef.current?.focus?.()
    triggerRef.current = null
  }, [])

  const clear = useCallback(() => {
    abortRef.current?.abort()
    commit([])
    setStreaming(false)
  }, [commit])

  const stop = useCallback(() => {
    abortRef.current?.abort()
  }, [])

  // Streams a completion for the given conversation, appending an assistant turn.
  const run = useCallback(async (history: ChatMessage[]) => {
    setStreaming(true)
    commit([...history, { role: 'assistant', content: '' }])

    const controller = new AbortController()
    abortRef.current = controller

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: history.map(m => ({ role: m.role, content: m.content })),
          topicId: topicIdRef.current,
        }),
        signal: controller.signal,
      })
      if (!res.ok) throw new Error('Failed')

      const { tokens } = await readStream(res, full => {
        commit([...history, { role: 'assistant', content: full }])
      })
      notifyTokens(tokens)
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') {
        // Clean stop — keep whatever streamed so far, but drop an empty bubble.
        const cur = messagesRef.current
        if (cur[cur.length - 1]?.content === '') commit(cur.slice(0, -1))
      } else {
        commit([...history, { role: 'assistant', content: ERROR_MESSAGE }])
      }
    } finally {
      setStreaming(false)
      abortRef.current = null
    }
  }, [commit])

  const send = useCallback((text: string) => {
    const trimmed = text.trim()
    if (!trimmed || streaming) return
    void run([...messagesRef.current, { role: 'user', content: trimmed }])
  }, [streaming, run])

  const regenerate = useCallback(() => {
    if (streaming) return
    // Drop the trailing assistant turn(s) and re-send up to the last user message.
    const cur = messagesRef.current
    let end = cur.length
    while (end > 0 && cur[end - 1].role === 'assistant') end--
    if (end === 0) return
    void run(cur.slice(0, end))
  }, [streaming, run])

  const actions = useMemo<ChatActions>(
    () => ({ openChat, closeChat, clear, send, stop, regenerate }),
    [openChat, closeChat, clear, send, stop, regenerate],
  )
  const state = useMemo<ChatStateValue>(
    () => ({ open, topicId, topicName, messages, streaming }),
    [open, topicId, topicName, messages, streaming],
  )

  return (
    <ChatActionsContext.Provider value={actions}>
      <ChatStateContext.Provider value={state}>
        {children}
      </ChatStateContext.Provider>
    </ChatActionsContext.Provider>
  )
}
