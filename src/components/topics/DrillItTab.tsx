'use client'

import { useEffect, useState } from 'react'
import { Loader2, Mic, MicOff, Dumbbell, Check, X, Flame } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { notifyTokens, tokensFromRes } from '@/lib/notify-tokens'
import { upsertReviewCard } from '@/lib/review-cards'
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition'
import type { Topic, TopicNote, RecallMode } from '@/types/database'

const PASS_PCT = 80
const FLUENT_STREAK = 3

interface Grade {
  score: number
  feedback: string
  strong: string[]
  missing: string[]
  model_answer: string
}

export function DrillItTab({ topic, note }: { topic: Topic; note: TopicNote | null }) {
  const marks = 10
  const modelHint = note?.model_answer_10mark || note?.key_points || note?.study_note || ''
  const [text, setText] = useState('')
  const [mode, setMode] = useState<RecallMode>('write')
  const [loading, setLoading] = useState(false)
  const [grade, setGrade] = useState<Grade | null>(null)
  const [streak, setStreak] = useState(0)
  const [streakLoaded, setStreakLoaded] = useState(false)
  const { supported, listening, toggle } = useSpeechRecognition(t => setText(prev => (prev ? `${prev} ${t}` : t)))

  useEffect(() => {
    let active = true
    // Reset the load guard when switching topics before the async fetch resolves.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStreakLoaded(false)
    async function load() {
      const supabase = createClient()
      const { data } = await supabase
        .from('recall_reps').select('streak').eq('topic_id', topic.id)
        .order('created_at', { ascending: false }).limit(1).maybeSingle()
      if (!active) return
      setStreak(data?.streak ?? 0)
      setStreakLoaded(true)
    }
    load()
    return () => { active = false }
  }, [topic.id])

  const fluent = streak >= FLUENT_STREAK

  async function submit() {
    if (text.trim().length < 20) { toast.error('Reproduce more of the answer from memory'); return }
    if (!streakLoaded) { toast.error('Still loading your streak — one moment'); return }
    setLoading(true)
    try {
      const res = await fetch('/api/ai/grade-answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topicName: topic.name, questionType: '10mark', userAnswer: text, modelAnswer: modelHint, questionContext: `Reproduce the key facts of "${topic.name}" from memory.` }),
      })
      if (!res.ok) throw new Error('failed')
      notifyTokens(tokensFromRes(res))
      const data: Grade = await res.json()
      setGrade(data)

      const pct = Math.round((data.score / marks) * 100)
      const passed = pct >= PASS_PCT
      const newStreak = passed ? streak + 1 : 0
      setStreak(newStreak)

      const supabase = createClient()
      await supabase.from('recall_reps').insert({
        topic_id: topic.id,
        prompt: `Reproduce ${topic.name}`,
        mode,
        score: pct,
        passed,
        streak: newStreak,
      })

      // A missed rep re-surfaces the topic in the spaced-repetition queue.
      if (!passed) {
        await upsertReviewCard({ topicId: topic.id, key: `t_${topic.id}`, front: `Drill it: ${topic.name}`, back: topic.name, grade: 'again', source: 'recall_miss' })
      }
      toast[passed ? 'success' : 'message'](passed
        ? (newStreak >= FLUENT_STREAK ? `Fluent! ${newStreak} in a row 🔥` : `Passed — streak ${newStreak}/${FLUENT_STREAK}`)
        : `${pct}% — keep drilling, streak reset`)
    } catch {
      toast.error('Could not grade your attempt')
    } finally {
      setLoading(false)
    }
  }

  function next() { setText(''); setGrade(null) }

  return (
    <div>
      <div className="mb-4 px-3 py-2.5 bg-purple-50 dark:bg-purple-900/15 border border-purple-200 dark:border-purple-800/50 rounded-lg">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-purple-900 dark:text-purple-200 flex items-center gap-1.5"><Dumbbell size={14} /> Recall by doing</p>
          <span className={cn('flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full', fluent ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400' : 'bg-gray-100 dark:bg-[#30363D] text-gray-500')}>
            <Flame size={12} /> {streak}/{FLUENT_STREAK}
          </span>
        </div>
        <p className="text-xs text-purple-700 dark:text-purple-300/80 mt-0.5">Reproduce the full answer for <span className="font-medium">{topic.name}</span> from memory — by writing or saying it aloud. Hit {PASS_PCT}%+ three times to reach fluency.</p>
      </div>

      <div className="flex gap-2 mb-3">
        {(['write', 'speak'] as RecallMode[]).map(m => {
          const disabled = m === 'speak' && !supported
          return (
            <button
              key={m}
              onClick={() => !disabled && setMode(m)}
              disabled={disabled}
              className={cn('flex-1 py-2 text-xs font-medium rounded-lg border transition-colors',
                mode === m ? 'border-purple-400 text-purple-600 bg-purple-50 dark:bg-purple-900/20' : 'border-gray-200 dark:border-[#30363D] text-gray-500',
                disabled && 'opacity-40 cursor-not-allowed')}
            >
              {m === 'write' ? 'Write it' : supported ? 'Say it aloud' : 'Say it (unsupported)'}
            </button>
          )
        })}
      </div>

      {!grade ? (
        <>
          <div className="relative">
            <textarea
              value={text}
              onChange={e => setText(e.target.value)}
              rows={10}
              placeholder={mode === 'speak' ? 'Tap Speak and recite the answer aloud…' : 'Write the full answer from memory — no peeking…'}
              className="w-full text-sm text-gray-700 dark:text-gray-100 dark:bg-transparent border border-gray-200 dark:border-[#30363D] rounded-lg p-3 resize-y focus:outline-none focus:ring-2 focus:ring-purple-400/30 focus:border-purple-400"
            />
            {mode === 'speak' && supported && (
              <button
                onClick={toggle}
                className={cn('absolute bottom-3 right-3 flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border transition-colors',
                  listening ? 'border-danger-400 text-danger-600 bg-danger-50 dark:bg-danger-900/20 animate-pulse' : 'border-gray-200 dark:border-[#30363D] text-gray-500')}
              >
                {listening ? <MicOff size={13} /> : <Mic size={13} />}{listening ? 'Stop' : 'Speak'}
              </button>
            )}
          </div>
          <div className="flex justify-end mt-3">
            <button onClick={submit} disabled={loading || !streakLoaded} className="flex items-center gap-1.5 px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50">
              {loading && <Loader2 size={14} className="animate-spin" />} Grade my rep
            </button>
          </div>
        </>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="text-2xl font-semibold text-gray-900 dark:text-gray-100">{Math.round((grade.score / marks) * 100)}%</div>
            <div className="flex-1 h-2 bg-gray-100 dark:bg-[#30363D] rounded-full overflow-hidden">
              <div className={cn('h-full', (grade.score / marks) * 100 >= PASS_PCT ? 'bg-success-500' : 'bg-warning-500')} style={{ width: `${(grade.score / marks) * 100}%` }} />
            </div>
          </div>
          <p className="text-sm text-gray-700 dark:text-gray-200 leading-relaxed">{grade.feedback}</p>
          {grade.strong?.length > 0 && (
            <div>
              <p className="text-xs font-medium text-gray-500 mb-1.5">Got right</p>
              <ul className="space-y-1">{grade.strong.map((s, i) => <li key={i} className="text-sm text-gray-700 dark:text-gray-200 flex gap-2"><Check size={14} className="mt-0.5 text-success-500 flex-shrink-0" />{s}</li>)}</ul>
            </div>
          )}
          {grade.missing?.length > 0 && (
            <div>
              <p className="text-xs font-medium text-gray-500 mb-1.5">Missed — drill these next</p>
              <ul className="space-y-1">{grade.missing.map((s, i) => <li key={i} className="text-sm text-gray-700 dark:text-gray-200 flex gap-2"><X size={14} className="mt-0.5 text-danger-500 flex-shrink-0" />{s}</li>)}</ul>
            </div>
          )}
          <div className="flex justify-end">
            <button onClick={next} className="text-sm text-purple-600 dark:text-purple-400 font-medium hover:underline">Do another rep</button>
          </div>
        </div>
      )}
    </div>
  )
}
