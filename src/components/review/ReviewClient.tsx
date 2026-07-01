'use client'

import { useMemo, useState } from 'react'
import { CheckCircle2, CalendarClock, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { schedule, dueBucket, type Grade } from '@/lib/spaced-repetition'
import { reviewRow, REVIEW_CONFLICT } from '@/lib/review-cards'
import type { CardSource } from '@/types/database'

interface ReviewCard {
  card_key: string
  topic_id: string | null
  front: string
  back: string
  ease: number
  ef: number
  reps: number
  lapses: number
  interval_days: number
  due_date: string | null
  source: CardSource | null
  topic_name: string | null
}

const GRADES: { grade: Grade; label: string; cls: string }[] = [
  { grade: 'again', label: 'Again', cls: 'border-danger-300 dark:border-danger-700 text-danger-700 dark:text-danger-400 hover:bg-danger-50 dark:hover:bg-danger-900/20' },
  { grade: 'hard',  label: 'Hard',  cls: 'border-warning-300 dark:border-warning-700 text-warning-700 dark:text-warning-400 hover:bg-warning-50 dark:hover:bg-warning-900/20' },
  { grade: 'good',  label: 'Good',  cls: 'border-brand-300 dark:border-brand-700 text-brand-700 dark:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-900/20' },
  { grade: 'easy',  label: 'Easy',  cls: 'border-success-300 dark:border-success-700 text-success-700 dark:text-success-400 hover:bg-success-50 dark:hover:bg-success-900/20' },
]

const SOURCE_LABEL: Record<CardSource, string> = {
  keypoint: 'Key point',
  feynman_gap: 'Feynman gap',
  recall_miss: 'Recall miss',
  drill: 'Drill',
}

export function ReviewClient({ initialCards }: { initialCards: ReviewCard[] }) {
  // Simple FIFO: the card being reviewed is always queue[0]. On grade we drop the head, and on
  // "again" we re-push the updated card to the tail so it comes back around this session.
  const [queue, setQueue] = useState<ReviewCard[]>(initialCards)
  const [flipped, setFlipped] = useState(false)
  const [reviewed, setReviewed] = useState(0)
  const [saving, setSaving] = useState(false)

  const total = initialCards.length
  const card = queue[0]

  const overdue = useMemo(() => queue.filter(c => dueBucket(c.due_date) === 'overdue').length, [queue])

  async function grade(g: Grade) {
    if (!card || saving) return
    setSaving(true)
    const sched = schedule(g, card)

    setReviewed(r => r + 1)
    setFlipped(false)
    setQueue(prev => {
      const [head, ...rest] = prev
      return g === 'again' ? [...rest, { ...head, ...sched }] : rest
    })

    const supabase = createClient()
    const { error } = await supabase
      .from('flashcard_reviews')
      .upsert(reviewRow(card, sched), { onConflict: REVIEW_CONFLICT })
    if (error) toast.error('Could not save review progress')
    setSaving(false)
  }

  if (total === 0) {
    return (
      <div className="max-w-lg mx-auto px-4 py-20 text-center">
        <Sparkles size={32} className="mx-auto mb-3 text-brand-400" />
        <p className="text-lg font-medium text-gray-900 dark:text-gray-100">You&apos;re all caught up</p>
        <p className="text-sm text-gray-400 mt-1">No cards are due right now. New reviews appear here as you study, drill, explain, and recall.</p>
      </div>
    )
  }

  if (!card) {
    return (
      <div className="max-w-lg mx-auto px-4 py-20 text-center">
        <CheckCircle2 size={32} className="mx-auto mb-3 text-success-400" />
        <p className="text-lg font-medium text-gray-900 dark:text-gray-100">Review complete</p>
        <p className="text-sm text-gray-400 mt-1 mb-6">You reviewed {reviewed} card{reviewed === 1 ? '' : 's'} today. Come back tomorrow.</p>
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Daily review</h1>
        <div className="flex items-center gap-2 text-xs text-gray-400">
          {overdue > 0 && <span className="flex items-center gap-1 text-danger-600 dark:text-danger-400"><CalendarClock size={12} />{overdue} overdue</span>}
          <span className="text-brand-600 dark:text-brand-400 font-medium">{queue.length} left</span>
        </div>
      </div>

      <div className="h-1.5 bg-gray-100 dark:bg-[#30363D] rounded-full overflow-hidden mb-6">
        <div className="h-full bg-brand-500 transition-all" style={{ width: `${total ? (reviewed / (reviewed + queue.length)) * 100 : 0}%` }} />
      </div>

      <div className="flex items-center justify-between text-xs text-gray-400 mb-2">
        <span className="truncate max-w-[70%]">{card.topic_name ?? 'General'}</span>
        {card.source && <span className="px-2 py-0.5 rounded-full bg-gray-100 dark:bg-[#30363D] text-gray-500 dark:text-gray-400">{SOURCE_LABEL[card.source]}</span>}
      </div>

      <div onClick={() => setFlipped(f => !f)} className="cursor-pointer mb-4">
        <div className="bg-white dark:bg-[#161B22] border-2 border-teal-200 dark:border-teal-800/50 rounded-2xl p-8 min-h-[200px] flex flex-col items-center justify-center text-center">
          {flipped ? (
            <p className="text-sm text-teal-900 dark:text-teal-100 leading-relaxed">{card.back}</p>
          ) : (
            <>
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100 leading-relaxed">{card.front}</p>
              <p className="text-[10px] text-gray-300 dark:text-gray-600 mt-4">Tap to reveal</p>
            </>
          )}
        </div>
      </div>

      {flipped ? (
        <div className="grid grid-cols-4 gap-2">
          {GRADES.map(g => (
            <button key={g.grade} onClick={() => grade(g.grade)} disabled={saving} className={cn('py-3 border-2 text-sm font-medium rounded-xl transition-colors disabled:opacity-50', g.cls)}>{g.label}</button>
          ))}
        </div>
      ) : (
        <button onClick={() => setFlipped(true)} className="w-full py-3 bg-brand-600 text-white text-sm font-medium rounded-xl hover:bg-brand-800 transition-colors">Show answer</button>
      )}
    </div>
  )
}
