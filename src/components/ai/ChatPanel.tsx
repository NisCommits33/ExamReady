'use client'

import { useState, useRef, useEffect } from 'react'
import { X, Send, Square, Loader2, MessageSquare, Copy, RefreshCw, Trash2, Check } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Markdown } from '@/components/ui/Markdown'
import { useChatState, useChatActions } from './ChatProvider'

/** Quick-start prompts shown in the empty state. */
const TOPIC_PROMPTS = ['Explain this simply', 'Give me an MCQ', 'Common exam traps', 'Key numbers to remember']
const GENERAL_PROMPTS = ['Quiz me on a weak area', 'Explain a tricky concept', 'How should I revise today?']

export function ChatPanel() {
  const { open, topicName, messages, streaming } = useChatState()
  const { closeChat, clear, send, stop, regenerate } = useChatActions()
  const [input, setInput] = useState('')
  const [kbInset, setKbInset] = useState(0) // px the on-screen keyboard covers (mobile)
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  // Keep the mobile bottom sheet above the on-screen keyboard via the VisualViewport API.
  useEffect(() => {
    if (!open) return
    const vv = window.visualViewport
    if (!vv) return
    const onResize = () => {
      const inset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop)
      setKbInset(window.innerWidth < 768 ? inset : 0)
    }
    onResize()
    vv.addEventListener('resize', onResize)
    vv.addEventListener('scroll', onResize)
    return () => { vv.removeEventListener('resize', onResize); vv.removeEventListener('scroll', onResize); setKbInset(0) }
  }, [open])

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100)
  }, [open])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Escape to close; trap Tab within the panel while it's open.
  useEffect(() => {
    if (!open) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); closeChat(); return }
      if (e.key !== 'Tab' || !panelRef.current) return
      const focusable = panelRef.current.querySelectorAll<HTMLElement>(
        'button, textarea, [href], input, select, [tabindex]:not([tabindex="-1"])',
      )
      const list = Array.from(focusable).filter(el => !el.hasAttribute('disabled'))
      if (list.length === 0) return
      const first = list[0]
      const last = list[list.length - 1]
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, closeChat])

  function submit() {
    const text = input.trim()
    if (!text || streaming) return
    setInput('')
    send(text)
  }

  async function copyMessage(content: string, idx: number) {
    try {
      await navigator.clipboard.writeText(content)
      setCopiedIdx(idx)
      setTimeout(() => setCopiedIdx(c => (c === idx ? null : c)), 1500)
    } catch {
      toast('Could not copy to clipboard')
    }
  }

  function handleClear() {
    clear()
    toast('Chat cleared')
  }

  if (!open) return null

  const isEmpty = messages.length === 0
  const prompts = topicName ? TOPIC_PROMPTS : GENERAL_PROMPTS
  const lastIsAssistant = messages.length > 0 && messages[messages.length - 1].role === 'assistant'

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/20 dark:bg-black/50 md:hidden animate-in fade-in duration-200" onClick={closeChat} />

      {/* Panel */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Ask AI chat"
        style={kbInset > 0 ? { bottom: kbInset, height: `calc(85dvh - ${kbInset}px)` } : undefined}
        className={cn(
          'fixed z-50 flex flex-col bg-white dark:bg-[#161B22] shadow-2xl',
          'bottom-0 left-0 right-0 h-[85dvh] rounded-t-2xl',
          'md:top-0 md:bottom-0 md:right-0 md:left-auto md:h-full md:w-[400px] md:rounded-none md:rounded-l-2xl',
          'animate-in slide-in-from-bottom md:slide-in-from-right duration-200 ease-out',
        )}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200 dark:border-[#30363D] flex-shrink-0">
          <div className="w-7 h-7 rounded-lg bg-brand-600 flex items-center justify-center">
            <MessageSquare size={14} className="text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Ask AI</p>
            {topicName && <p className="text-xs text-gray-400 truncate">{topicName}</p>}
          </div>
          <button
            onClick={handleClear}
            disabled={isEmpty || streaming}
            aria-label="Clear conversation"
            title="Clear conversation"
            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-[#1C2128] text-gray-400 transition-colors disabled:opacity-30"
          >
            <Trash2 size={16} />
          </button>
          <button
            onClick={closeChat}
            aria-label="Close chat"
            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-[#1C2128] text-gray-400 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Messages */}
        <div aria-live="polite" className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {isEmpty && (
            <div className="flex flex-col items-center text-center pt-6 px-2">
              <div className="w-12 h-12 rounded-2xl bg-brand-600 flex items-center justify-center mb-3">
                <MessageSquare size={22} className="text-white" />
              </div>
              <p className="text-sm text-gray-700 dark:text-gray-200 font-medium">
                {topicName ? `Ask me anything about ${topicName}` : 'Your AI study assistant'}
              </p>
              <p className="text-xs text-gray-400 mt-1">
                Definitions, exam traps, key numbers, or practice MCQs.
              </p>
              <div className="flex flex-wrap justify-center gap-2 mt-4">
                {prompts.map(p => (
                  <button
                    key={p}
                    onClick={() => send(p)}
                    className="px-3 py-1.5 text-xs font-medium text-brand-600 bg-brand-50 dark:bg-brand-900/20 rounded-full hover:bg-brand-100 dark:hover:bg-brand-900/40 transition-colors"
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => {
            const isLastAssistant = msg.role === 'assistant' && i === messages.length - 1
            return (
              <div key={i} className={cn('flex gap-2 group', msg.role === 'user' && 'justify-end')}>
                {msg.role === 'assistant' && (
                  <div className="w-6 h-6 rounded-full bg-brand-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-white text-[9px] font-bold">AI</span>
                  </div>
                )}
                <div className={cn('flex flex-col gap-1 max-w-[85%]', msg.role === 'user' && 'items-end')}>
                  <div className={cn(
                    'rounded-2xl px-3.5 py-2.5 text-sm',
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
                  {/* Assistant actions — copy always, regenerate on the last reply */}
                  {msg.role === 'assistant' && msg.content && (
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                      <button
                        onClick={() => copyMessage(msg.content, i)}
                        aria-label="Copy reply"
                        title="Copy reply"
                        className="p-1 rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-[#1C2128] transition-colors"
                      >
                        {copiedIdx === i ? <Check size={13} className="text-green-500" /> : <Copy size={13} />}
                      </button>
                      {isLastAssistant && !streaming && (
                        <button
                          onClick={regenerate}
                          aria-label="Regenerate reply"
                          title="Regenerate reply"
                          className="p-1 rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-[#1C2128] transition-colors"
                        >
                          <RefreshCw size={13} />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )
          })}

          {streaming && lastIsAssistant && messages[messages.length - 1]?.content === '' && (
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
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit() } }}
              placeholder={topicName ? 'Ask about this topic…' : 'Ask anything…'}
              rows={1}
              aria-label="Message"
              className="flex-1 bg-transparent text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 resize-none focus:outline-none leading-relaxed max-h-32"
              style={{ fieldSizing: 'content' } as React.CSSProperties}
            />
            {streaming ? (
              <button
                onClick={stop}
                aria-label="Stop generating"
                title="Stop generating"
                className="flex-shrink-0 w-8 h-8 rounded-lg bg-gray-300 dark:bg-[#30363D] text-gray-700 dark:text-gray-200 flex items-center justify-center hover:bg-gray-400 dark:hover:bg-[#40464D] transition-colors"
              >
                <Square size={12} className="fill-current" />
              </button>
            ) : (
              <button
                onClick={submit}
                disabled={!input.trim()}
                aria-label="Send message"
                className="flex-shrink-0 w-8 h-8 rounded-lg bg-brand-600 text-white flex items-center justify-center hover:bg-brand-800 disabled:opacity-40 transition-colors"
              >
                <Send size={14} />
              </button>
            )}
          </div>
          <p className="text-[10px] text-gray-400 text-center mt-1.5">Press Enter to send · Shift+Enter for newline</p>
        </div>
      </div>
    </>
  )
}
