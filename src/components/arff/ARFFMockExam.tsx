'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Loader2, Timer, ChevronLeft, ChevronRight } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { saveDrillResult } from '@/lib/drill-results'
import { ARFFMockExamResults, type ExamResult } from './ARFFMockExamResults'
import type { Topic, P2Answer, QuestionType } from '@/types/database'

type Phase = 'setup' | 'generating' | 'exam' | 'grading' | 'results'

interface ExamQuestion {
  topic: Topic
  questionType: QuestionType
  questionText: string
  hints: string[]
  userAnswer: string
}

interface Props {
  topics: Topic[]
  allScores: P2Answer[]
  onBack: () => void
}

function pickTopics(topics: Topic[], allScores: P2Answer[]): Topic[] {
  const counts = new Map<string, number>()
  allScores.forEach(s => counts.set(s.topic_id, (counts.get(s.topic_id) ?? 0) + 1))
  const weighted = topics.map(t => ({ t, w: 1 / ((counts.get(t.id) ?? 0) + 1) + Math.random() * 0.5 }))
  weighted.sort((a, b) => b.w - a.w)
  return weighted.slice(0, 5).map(w => w.t)
}

export function ARFFMockExam({ topics, allScores, onBack }: Props) {
  const [phase, setPhase] = useState<Phase>('setup')
  const [questions, setQuestions] = useState<ExamQuestion[]>([])
  const [currentQ, setCurrentQ] = useState(0)
  const [results, setResults] = useState<ExamResult[]>([])
  const [gradingIdx, setGradingIdx] = useState(0)

  const startTimeRef = useRef(0)
  const [timeLeft, setTimeLeft] = useState(45 * 60)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const stopTimer = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
  }, [])

  useEffect(() => { return () => stopTimer() }, [stopTimer])

  async function startExam() {
    setPhase('generating')
    const picked = pickTopics(topics, allScores)
    const types: QuestionType[] = ['5mark', '5mark', '5mark', '10mark', '10mark']

    try {
      const responses = await Promise.allSettled(
        picked.map((t, i) =>
          fetch('/api/ai/generate-p2-question', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ topicName: t.name, subsections: t.subsections, marks: types[i], topicId: t.id }),
          }).then(r => r.json())
        )
      )

      const qs: ExamQuestion[] = picked.map((t, i) => {
        const res = responses[i]
        const data = res.status === 'fulfilled' ? res.value : {}
        return {
          topic: t,
          questionType: types[i],
          questionText: data.question ?? `Write about ${t.name}`,
          hints: data.hints ?? [],
          userAnswer: '',
        }
      })

      setQuestions(qs)
      setCurrentQ(0)
      startTimeRef.current = Date.now()
      setTimeLeft(45 * 60)
      timerRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000)
        const remaining = Math.max(0, 45 * 60 - elapsed)
        setTimeLeft(remaining)
        if (remaining === 0) submitExam(qs)
      }, 1000)
      setPhase('exam')
    } catch {
      toast.error('Failed to generate questions')
      setPhase('setup')
    }
  }

  function updateAnswer(idx: number, text: string) {
    setQuestions(prev => prev.map((q, i) => i === idx ? { ...q, userAnswer: text } : q))
  }

  async function submitExam(qs?: ExamQuestion[]) {
    stopTimer()
    const examQs = qs ?? questions
    setPhase('grading')
    setGradingIdx(0)
    const examResults: ExamResult[] = []
    const supabase = createClient()
    const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000)

    for (let i = 0; i < examQs.length; i++) {
      setGradingIdx(i + 1)
      const q = examQs[i]
      try {
        const res = await fetch('/api/ai/grade-answer', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            topicName: q.topic.name,
            questionType: q.questionType,
            userAnswer: q.userAnswer || '(no answer provided)',
            questionContext: q.questionText,
            gradingHints: q.hints,
          }),
        })
        const grade = await res.json()
        examResults.push({
          topicName: q.topic.name,
          questionType: q.questionType,
          questionText: q.questionText,
          userAnswer: q.userAnswer,
          grade,
        })

        await supabase.from('p2_answers').insert({
          topic_id: q.topic.id,
          question_type: q.questionType,
          user_answer: q.userAnswer || '(no answer)',
          ai_feedback: grade.feedback,
          ai_score: grade.score,
          question_text: q.questionText,
        })

        if (i < examQs.length - 1) await new Promise(r => setTimeout(r, 500))
      } catch {
        examResults.push({
          topicName: q.topic.name, questionType: q.questionType, questionText: q.questionText, userAnswer: q.userAnswer,
          grade: { score: 0, feedback: 'Grading failed', strong: [], missing: [], model_answer: '' },
        })
      }
    }

    const totalScore = examResults.reduce((s, r) => s + r.grade.score, 0)
    const totalMarks = examResults.reduce((s, r) => s + (r.questionType === '5mark' ? 5 : 10), 0)
    saveDrillResult({ section: 'arff', score: totalScore, total: totalMarks })

    setResults(examResults)
    setPhase('results')
  }

  if (phase === 'setup') {
    return (
      <div className="py-8 text-center">
        <div className="bg-teal-50 dark:bg-teal-900/20 border border-teal-200 dark:border-teal-800/50 rounded-xl p-6 mb-6 text-left">
          <h2 className="text-base font-semibold text-teal-900 dark:text-teal-100 mb-3">Mock Paper 2 Exam</h2>
          <ul className="space-y-2 text-sm text-teal-800 dark:text-teal-200">
            <li>5 questions across different topics</li>
            <li>3 × 5-mark + 2 × 10-mark = 35 total marks</li>
            <li>45-minute time limit</li>
            <li>Navigate freely between questions</li>
            <li>AI grades each answer after submission</li>
          </ul>
        </div>
        <button onClick={startExam} className="px-8 py-3 bg-teal-400 text-white text-sm font-medium rounded-xl hover:bg-teal-600 transition-colors active:scale-[0.98]">
          Start Mock Exam
        </button>
        <button onClick={onBack} className="block mx-auto mt-3 text-xs text-gray-400 hover:text-gray-600 transition-colors">Cancel</button>
      </div>
    )
  }

  if (phase === 'generating') {
    return (
      <div className="py-20 text-center">
        <Loader2 size={24} className="animate-spin text-teal-400 mx-auto mb-3" />
        <p className="text-sm text-gray-400">Preparing your exam…</p>
      </div>
    )
  }

  if (phase === 'grading') {
    return (
      <div className="py-20 text-center">
        <Loader2 size={24} className="animate-spin text-teal-400 mx-auto mb-3" />
        <p className="text-sm text-gray-400">Grading {gradingIdx}/{questions.length}…</p>
        <div className="w-32 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full mx-auto mt-3 overflow-hidden">
          <div className="h-full bg-teal-400 rounded-full transition-all" style={{ width: `${(gradingIdx / questions.length) * 100}%` }} />
        </div>
      </div>
    )
  }

  if (phase === 'results') {
    const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000)
    return <ARFFMockExamResults results={results} elapsedSeconds={elapsed} onRetry={startExam} onBack={onBack} />
  }

  // Exam phase
  const q = questions[currentQ]
  const marks = q.questionType === '5mark' ? 5 : 10
  const mins = Math.floor(timeLeft / 60)
  const secs = timeLeft % 60
  const timerColor = timeLeft > 30 * 60 ? 'text-success-500' : timeLeft > 15 * 60 ? 'text-warning-500' : 'text-danger-500'

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          {questions.map((_, i) => (
            <button key={i} onClick={() => setCurrentQ(i)} className={cn('w-7 h-7 rounded-full text-xs font-medium transition-all', i === currentQ ? 'bg-teal-400 text-white' : questions[i].userAnswer ? 'bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400' : 'bg-gray-100 dark:bg-[#1C2128] text-gray-500')}>
              {i + 1}
            </button>
          ))}
        </div>
        <div className={cn('flex items-center gap-1 text-sm font-mono tabular-nums', timerColor)}>
          <Timer size={14} />
          {mins}:{String(secs).padStart(2, '0')}
        </div>
      </div>

      <div className="bg-teal-50 dark:bg-teal-900/20 border border-teal-200 dark:border-teal-800/50 rounded-xl p-4 mb-4">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-teal-600 text-white">{marks}m</span>
          <span className="text-xs text-teal-700 dark:text-teal-400">{q.topic.name}</span>
        </div>
        <p className="text-sm text-teal-900 dark:text-teal-100 leading-relaxed">{q.questionText}</p>
      </div>

      <textarea
        value={q.userAnswer}
        onChange={e => updateAnswer(currentQ, e.target.value)}
        rows={10}
        placeholder={`Write your ${marks}-mark answer…`}
        className="w-full px-4 py-3 text-sm border border-gray-200 dark:border-[#30363D] dark:bg-[#1C2128] dark:text-gray-100 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-teal-400/30 focus:border-teal-400 transition-all leading-relaxed"
        autoFocus
      />
      <p className="text-xs text-gray-400 mt-1 mb-4">{q.userAnswer.split(/\s+/).filter(Boolean).length} words</p>

      <div className="flex gap-2">
        <button
          onClick={() => setCurrentQ(i => Math.max(0, i - 1))}
          disabled={currentQ === 0}
          className="flex items-center gap-1 px-4 py-2.5 text-sm text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-[#30363D] rounded-xl disabled:opacity-30 hover:bg-gray-50 dark:hover:bg-[#1C2128] transition-colors"
        >
          <ChevronLeft size={14} /> Prev
        </button>
        {currentQ < questions.length - 1 ? (
          <button
            onClick={() => setCurrentQ(i => i + 1)}
            className="flex-1 flex items-center justify-center gap-1 py-2.5 text-sm font-medium text-white bg-teal-400 rounded-xl hover:bg-teal-600 transition-colors"
          >
            Next <ChevronRight size={14} />
          </button>
        ) : (
          <button
            onClick={() => submitExam()}
            className="flex-1 py-2.5 text-sm font-medium text-white bg-brand-600 rounded-xl hover:bg-brand-800 transition-colors"
          >
            Submit Exam
          </button>
        )}
      </div>
    </div>
  )
}
