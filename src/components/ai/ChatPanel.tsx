'use client'

import { useState, useRef, useEffect } from 'react'
import { X, Send, Loader2, MessageSquare } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Markdown } from '@/components/ui/Markdown'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

interface ChatPanelProps {
  open: boolean
  onClose: () => void
  topicId?: string
  topicName?: string
}

export function ChatPanel({ open, onClose, topicId, topicName }: ChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100)
      if (messages.length === 0 && topicName) {
        setMessages([{
          role: 'assistant',
          content: `Ask me anything about **${topicName}** — definitions, exam traps, key numbers, or practice MCQs.`,
        }])
      }
    }
  }, [open])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function send() {
    const text = input.trim()
    if (!text || streaming) return
    setInput('')

    const userMsg: Message = { role: 'user', content: text }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setStreaming(true)

    const assistantMsg: Message = { role: 'assistant', content: '' }
    setMessages(prev => [...prev, assistantMsg])

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages.map(m => ({ role: m.role, content: m.content })),
          topicId,
        }),
      })

      if (!res.ok) throw new Error('Failed')

      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let full = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value)
        for (const line of chunk.split('\n')) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6)
            if (data === '[DONE]') break
            try {
              const delta = JSON.parse(data).choices?.[0]?.delta?.content ?? ''
              full += delta
              setMessages(prev => [
                ...prev.slice(0, -1),
                { role: 'assistant', content: full },
              ])
            } catch {}
          }
        }
      }
    } catch {
      setMessages(prev => [
        ...prev.slice(0, -1),
        { role: 'assistant', content: 'Sorry, something went wrong. Please try again.' },
      ])
    } finally {
      setStreaming(false)
    }
  }

  if (!open) return null

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/20 dark:bg-black/50 md:hidden" onClick={onClose} />

      {/* Panel */}
      <div className={cn(
        'fixed z-50 flex flex-col bg-white dark:bg-[#161B22] shadow-2xl',
        'bottom-0 left-0 right-0 h-[85dvh] rounded-t-2xl',
        'md:top-0 md:bottom-0 md:right-0 md:left-auto md:h-full md:w-[400px] md:rounded-none md:rounded-l-2xl',
      )}>
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200 dark:border-[#30363D] flex-shrink-0">
          <div className="w-7 h-7 rounded-lg bg-brand-600 flex items-center justify-center">
            <MessageSquare size={14} className="text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Ask AI</p>
            {topicName && <p className="text-xs text-gray-400 truncate">{topicName}</p>}
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-[#1C2128] text-gray-400 transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {messages.map((msg, i) => (
            <div key={i} className={cn('flex gap-2', msg.role === 'user' && 'justify-end')}>
              {msg.role === 'assistant' && (
                <div className="w-6 h-6 rounded-full bg-brand-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-white text-[9px] font-bold">AI</span>
                </div>
              )}
              <div className={cn(
                'max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm',
                msg.role === 'user'
                  ? 'bg-brand-600 text-white rounded-tr-sm'
                  : 'bg-gray-100 dark:bg-[#1C2128] text-gray-900 dark:text-gray-100 rounded-tl-sm'
              )}>
                {msg.role === 'assistant' ? (
                  <Markdown compact>{msg.content || '…'}</Markdown>
                ) : (
                  <p>{msg.content}</p>
                )}
              </div>
            </div>
          ))}
          {streaming && messages[messages.length - 1]?.content === '' && (
            <div className="flex gap-2">
              <div className="w-6 h-6 rounded-full bg-brand-600 flex items-center justify-center flex-shrink-0">
                <span className="text-white text-[9px] font-bold">AI</span>
              </div>
              <div className="bg-gray-100 dark:bg-[#1C2128] rounded-2xl rounded-tl-sm px-3.5 py-2.5">
                <Loader2 size={14} className="text-gray-400 animate-spin" />
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="px-4 py-3 border-t border-gray-200 dark:border-[#30363D] flex-shrink-0">
          <div className="flex items-end gap-2 bg-gray-100 dark:bg-[#1C2128] rounded-xl px-3 py-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
              placeholder="Ask about this topic…"
              rows={1}
              className="flex-1 bg-transparent text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 resize-none focus:outline-none leading-relaxed max-h-32"
              style={{ fieldSizing: 'content' } as React.CSSProperties}
            />
            <button
              onClick={send}
              disabled={!input.trim() || streaming}
              className="flex-shrink-0 w-8 h-8 rounded-lg bg-brand-600 text-white flex items-center justify-center hover:bg-brand-800 disabled:opacity-40 transition-colors"
            >
              <Send size={14} />
            </button>
          </div>
          <p className="text-[10px] text-gray-400 text-center mt-1.5">Press Enter to send · Shift+Enter for newline</p>
        </div>
      </div>
    </>
  )
}
