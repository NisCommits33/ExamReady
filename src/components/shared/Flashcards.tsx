'use client'

import { useState, useMemo, useEffect } from 'react'
import { RotateCcw, CheckCircle2, XCircle, CalendarClock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { cardKey, nextOnKnown, nextOnReview, isDue } from '@/lib/spaced-repetition'
import type { Topic } from '@/types/database'

interface Props {
  topics: Topic[]
  topicKeyPoints: { topic_id: string; key_points: string | null }[]
}

interface Card {
  key: string
  front: string
  back: string
  topicId: string
  topicName: string
}

interface ReviewState {
  ease: number
  due_date: string | null
}

function parseCards(keyPoints: string, topicId: string, topicName: string): Card[] {
  return keyPoints.split('\n')
    .filter(l => /^[\s]*[-*•]\s/.test(l) || /^[\s]*\d+[.)]\s/.test(l))
    .map(line => {
      const text = line.replace(/^[\s]*[-*•\d.)\s]+/, '').trim()
      if (!text || text.length < 10) return null
      const ci = text.indexOf(':'), di = text.indexOf('–')
      const si = ci > 0 && ci < 60 ? ci : di > 0 && di < 60 ? di : -1
      const front = si > 0 ? `What about: ${text.slice(0, si).trim()}?` : `What is: ${text.slice(0, 50).trim()}...?`
      return { key: cardKey(topicId, text), front, back: text, topicId, topicName }
    })
    .filter(Boolean) as Card[]
}

export function Flashcards({ topics, topicKeyPoints }: Props) {
  const [filter, setFilter] = useState<string>('all')
  const [dueOnly, setDueOnly] = useState(true)
  const [index, setIndex] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [reviews, setReviews] = useState<Record<string, ReviewState>>({})
  const [done, setDone] = useState<Set<string>>(new Set())
  const [loaded, setLoaded] = useState(false)

  const allCards = useMemo(() => {
    const cards: Card[] = []
    for (const kp of topicKeyPoints) {
      if (!kp.key_points) continue
      const topic = topics.find(t => t.id === kp.topic_id)
      if (topic) cards.push(...parseCards(kp.key_points, kp.topic_id, topic.name))
    }
    return cards
  }, [topics, topicKeyPoints])

  // Load review state for all cards once
  useEffect(() => {
    async function load() {
      if (allCards.length === 0) { setLoaded(true); return }
      const supabase = createClient()
      const keys = allCards.map(c => c.key)
      const map: Record<string, ReviewState> = {}
      for (let i = 0; i < keys.length; i += 200) {
        const { data } = await supabase.from('flashcard_reviews').select('card_key,ease,due_date').in('card_key', keys.slice(i, i + 200))
        for (const r of data ?? []) map[r.card_key] = { ease: r.ease, due_date: r.due_date }
      }
      setReviews(map)
      setLoaded(true)
    }
    load()
  }, [allCards])

  const cards = useMemo(() => {
    let c = filter === 'all' ? allCards : allCards.filter(x => x.topicId === filter)
    if (dueOnly) c = c.filter(x => isDue(reviews[x.key]?.due_date))
    // Due/new first, then by topic
    return c
  }, [allCards, filter, dueOnly, reviews])

  function reset() { setIndex(0); setFlipped(false); setDone(new Set()) }

  function findNext(from: number): number | null {
    for (let i = from; i < cards.length; i++) if (!done.has(cards[i].key)) return i
    for (let i = 0; i < from; i++) if (!done.has(cards[i].key)) return i
    return null
  }

  function advance() { setFlipped(false); const n = findNext(index + 1); if (n !== null) setIndex(n); else setIndex(cards.length) }

  async function mark(known: boolean) {
    const card = cards[index]
    if (!card) return
    const cur = reviews[card.key]?.ease ?? 0
    const sched = known ? nextOnKnown(cur) : nextOnReview()
    setReviews(prev => ({ ...prev, [card.key]: { ease: sched.ease, due_date: sched.due_date } }))
    setDone(prev => new Set(prev).add(card.key))
    advance()

    const supabase = createClient()
    await supabase.from('flashcard_reviews').upsert({
      card_key: card.key,
      topic_id: card.topicId,
      front: card.front,
      back: card.back,
      ease: sched.ease,
      interval_days: sched.interval_days,
      due_date: sched.due_date,
      last_reviewed: new Date().toISOString(),
    }, { onConflict: 'card_key' })
  }

  const dueCount = useMemo(() => {
    const base = filter === 'all' ? allCards : allCards.filter(x => x.topicId === filter)
    return base.filter(x => isDue(reviews[x.key]?.due_date)).length
  }, [allCards, filter, reviews])

  if (!loaded) return <div className="py-16 text-center"><div className="w-5 h-5 border-2 border-gray-200 border-t-brand-600 rounded-full animate-spin mx-auto" /></div>

  if (allCards.length === 0) return (
    <div className="py-16 text-center">
      <p className="text-sm text-gray-400 mb-1">No flashcards available</p>
      <p className="text-xs text-gray-400">Generate study notes with key points to create flashcards</p>
    </div>
  )

  const finished = index >= cards.length || cards.every(c => done.has(c.key))
  const card = cards[index]

  return (
    <div>
      <div className="flex items-center justify-between gap-2 mb-3">
        <select value={filter} onChange={e => { setFilter(e.target.value); reset() }} className="text-xs text-gray-600 dark:text-gray-400 bg-transparent border border-gray-200 dark:border-[#30363D] rounded-lg px-2.5 py-1.5 focus:outline-none max-w-[180px] truncate">
          <option value="all">All topics</option>
          {topics.filter(t => topicKeyPoints.some(kp => kp.topic_id === t.id && kp.key_points)).map(t => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
        <button onClick={() => { setDueOnly(d => !d); reset() }} className={cn('flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border transition-colors', dueOnly ? 'border-brand-400 text-brand-600 bg-brand-50 dark:bg-brand-900/20' : 'border-gray-200 dark:border-[#30363D] text-gray-400')}>
          <CalendarClock size={12} /> Due only
        </button>
      </div>

      <div className="flex items-center justify-center gap-3 text-xs text-gray-400 mb-4">
        <span className="text-brand-600 dark:text-brand-400 font-medium">{dueCount} due</span>
        <span>·</span>
        <span>{allCards.length} total</span>
      </div>

      {finished ? (
        <div className="py-12 text-center">
          <CheckCircle2 size={32} className="mx-auto mb-3 text-success-400" />
          <p className="text-lg font-medium text-gray-900 dark:text-gray-100">{dueOnly ? 'All due cards reviewed' : 'Session complete'}</p>
          <p className="text-sm text-gray-400 mt-1 mb-6">Come back tomorrow for your next review</p>
          <button onClick={reset} className="px-5 py-2.5 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-800 transition-colors"><RotateCcw size={14} className="inline mr-1.5" />Review again</button>
        </div>
      ) : card && (
        <>
          <p className="text-xs text-gray-400 text-center mb-3">{card.topicName}</p>
          <div onClick={() => setFlipped(f => !f)} className="cursor-pointer mb-4 [perspective:600px]">
            <div className={cn('relative transition-transform duration-300 [transform-style:preserve-3d]', flipped && '[transform:rotateY(180deg)]')}>
              <div className="bg-white dark:bg-[#161B22] border-2 border-teal-200 dark:border-teal-800/50 rounded-2xl p-8 min-h-[180px] flex flex-col items-center justify-center text-center [backface-visibility:hidden]">
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100 leading-relaxed">{card.front}</p>
                <p className="text-[10px] text-gray-300 dark:text-gray-600 mt-4">Tap to reveal</p>
              </div>
              <div className="absolute inset-0 bg-teal-50 dark:bg-teal-900/20 border-2 border-teal-300 dark:border-teal-700 rounded-2xl p-8 min-h-[180px] flex flex-col items-center justify-center text-center [backface-visibility:hidden] [transform:rotateY(180deg)]">
                <p className="text-sm text-teal-900 dark:text-teal-100 leading-relaxed">{card.back}</p>
              </div>
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={() => mark(false)} className="flex-1 flex items-center justify-center gap-1.5 py-3 border-2 border-warning-300 dark:border-warning-700 text-warning-700 dark:text-warning-400 text-sm font-medium rounded-xl hover:bg-warning-50 dark:hover:bg-warning-900/20 transition-colors"><XCircle size={15} /> Review again</button>
            <button onClick={() => mark(true)} className="flex-1 flex items-center justify-center gap-1.5 py-3 bg-success-400 text-white text-sm font-medium rounded-xl hover:bg-success-600 transition-colors"><CheckCircle2 size={15} /> Know it</button>
          </div>
        </>
      )}
    </div>
  )
}
