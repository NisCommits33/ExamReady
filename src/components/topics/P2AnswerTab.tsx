'use client'

import { useState, useRef } from 'react'
import { Loader2, FileImage, X, Sparkles, ChevronDown, ChevronUp, CheckCircle2, XCircle, RotateCcw, Lightbulb } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Markdown } from '@/components/ui/Markdown'
import { notifyTokens, tokensFromRes } from '@/lib/notify-tokens'
import type { Topic, TopicNote, P2Answer, QuestionType } from '@/types/database'

interface Props {
  topic: Topic
  answers: P2Answer[]
  existingNote: TopicNote | null
}

interface GradeResult {
  score: number
  feedback: string
  strong: string[]
  missing: string[]
  model_answer: string
}

type Phase = 'home' | 'write' | 'result'

export function P2AnswerTab({ topic, answers: initialAnswers, existingNote }: Props) {
  const [answers, setAnswers] = useState(initialAnswers)
  const [phase, setPhase] = useState<Phase>('home')
  const [mode, setMode] = useState<QuestionType | null>(null)
  const [text, setText] = useState('')
  const [grading, setGrading] = useState(false)
  const [question, setQuestion] = useState('')
  const [questionHints, setQuestionHints] = useState<string[]>([])
  const [generatingQuestion, setGeneratingQuestion] = useState<QuestionType | null>(null)
  const [extracting, setExtracting] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [gradeResult, setGradeResult] = useState<GradeResult | null>(null)
  const [resultQuestion, setResultQuestion] = useState('')
  const [showModelAnswer, setShowModelAnswer] = useState(false)
  const [showHint, setShowHint] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  // Every question shown this session (answered or not) so the API won't repeat them.
  const seenQuestionsRef = useRef<string[]>(initialAnswers.map(a => a.question_text).filter(Boolean) as string[])

  async function generateQuestion(marks: QuestionType) {
    setGeneratingQuestion(marks)
    try {
      const res = await fetch('/api/ai/generate-p2-question', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topicName: topic.name,
          subsections: topic.subsections,
          marks,
          topicId: topic.id,
          excludeQuestions: seenQuestionsRef.current.slice(-20),
        }),
      })
      const data = await res.json()
      notifyTokens(tokensFromRes(res))
      if (data.question) {
        seenQuestionsRef.current.push(data.question)
        setQuestion(data.question)
        setQuestionHints(data.hints ?? [])
        setShowHint(false)
        setMode(marks)
        setPhase('write')
      } else {
        toast.error(data.error ?? 'Could not generate question')
      }
    } catch {
      toast.error('Generation failed')
    } finally {
      setGeneratingQuestion(null)
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setExtracting(true)
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch('/api/ai/extract-p2-questions', { method: 'POST', body: form })
      const data = await res.json()
      if (data.question) {
        setQuestion(data.question)
        setQuestionHints([])
        toast.success('Question extracted — choose mark type to continue')
      } else {
        toast.error(data.error ?? 'Could not read question')
      }
    } catch {
      toast.error('Upload failed')
    } finally {
      setExtracting(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function submitAnswer() {
    if (!text.trim() || !mode) return
    setGrading(true)
    try {
      const modelAnswer = mode === '5mark' ? existingNote?.model_answer_5mark : existingNote?.model_answer_10mark
      const res = await fetch('/api/ai/grade-answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topicName: topic.name,
          questionType: mode,
          userAnswer: text,
          modelAnswer,
          questionContext: question,
          gradingHints: questionHints,
        }),
      })
      const result: GradeResult = await res.json()
      notifyTokens(tokensFromRes(res))

      const supabase = createClient()
      const { data } = await supabase.from('p2_answers').insert({
        topic_id: topic.id,
        question_type: mode,
        user_answer: text,
        ai_feedback: result.feedback,
        ai_score: result.score,
        question_text: question || null,
      }).select().single()

      if (data) {
        setAnswers(prev => [data, ...prev])
        setGradeResult(result)
        setResultQuestion(question)
        setShowModelAnswer(false)
        setPhase('result')
      }
    } catch {
      toast.error('Grading failed')
    } finally {
      setGrading(false)
    }
  }

  function resetToHome() {
    setPhase('home')
    setMode(null)
    setText('')
    setQuestion('')
    setQuestionHints([])
    setGradeResult(null)
    setResultQuestion('')
    setShowModelAnswer(false)
    setShowHint(false)
  }

  // ── Result phase ──────────────────────────────────────────────────────────
  if (phase === 'result' && gradeResult && mode) {
    const marks = mode === '5mark' ? 5 : 10
    const pct = (gradeResult.score / marks) * 100
    const isPassing = pct >= 60

    return (
      <div>
        {/* Score header */}
        <div className={cn(
          'rounded-xl p-5 mb-4 text-center',
          isPassing
            ? 'bg-success-50 dark:bg-success-900/20 border border-success-200 dark:border-success-800'
            : 'bg-warning-50 dark:bg-warning-900/20 border border-warning-200 dark:border-warning-800'
        )}>
          <p className={cn(
            'text-4xl font-bold',
            isPassing ? 'text-success-600' : 'text-warning-600'
          )}>
            {gradeResult.score}<span className="text-lg font-normal text-gray-400">/{marks}</span>
          </p>
          <p className={cn(
            'text-sm font-medium mt-1',
            isPassing ? 'text-success-700 dark:text-success-400' : 'text-warning-700 dark:text-warning-400'
          )}>
            {pct >= 80 ? 'Excellent' : pct >= 60 ? 'Good — room to improve' : pct >= 40 ? 'Needs more detail' : 'Review this topic'}
          </p>
        </div>

        {/* Question reminder */}
        {resultQuestion && (
          <div className="bg-teal-50 dark:bg-teal-900/20 border border-teal-200 dark:border-teal-800/50 rounded-xl p-3 mb-4">
            <p className="text-[10px] font-semibold text-teal-700 dark:text-teal-400 uppercase tracking-wide mb-1">Question</p>
            <p className="text-sm text-teal-900 dark:text-teal-100 leading-relaxed">{resultQuestion}</p>
          </div>
        )}

        {/* Feedback */}
        <div className="bg-white dark:bg-[#161B22] border border-gray-200 dark:border-[#30363D] rounded-xl p-4 mb-4">
          <p className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Feedback</p>
          <Markdown>{gradeResult.feedback}</Markdown>
        </div>

        {/* Strong points */}
        {gradeResult.strong?.length > 0 && (
          <div className="bg-success-50 dark:bg-success-900/10 border border-success-200 dark:border-success-800/50 rounded-xl p-4 mb-3">
            <div className="flex items-center gap-1.5 mb-2">
              <CheckCircle2 size={14} className="text-success-500" />
              <p className="text-[11px] font-semibold text-success-700 dark:text-success-400 uppercase tracking-wide">What you got right</p>
            </div>
            <ul className="space-y-1.5">
              {gradeResult.strong.map((s, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-success-800 dark:text-success-300">
                  <span className="text-success-400 mt-0.5">+</span>
                  <span>{s}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Missing points */}
        {gradeResult.missing?.length > 0 && (
          <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800/50 rounded-xl p-4 mb-4">
            <div className="flex items-center gap-1.5 mb-2">
              <XCircle size={14} className="text-red-400" />
              <p className="text-[11px] font-semibold text-red-700 dark:text-red-400 uppercase tracking-wide">What was missing</p>
            </div>
            <ul className="space-y-1.5">
              {gradeResult.missing.map((m, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-red-800 dark:text-red-300">
                  <span className="text-red-400 mt-0.5">−</span>
                  <span>{m}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Model answer */}
        {gradeResult.model_answer && (
          <div className="border border-gray-200 dark:border-[#30363D] rounded-xl overflow-hidden mb-4">
            <button
              onClick={() => setShowModelAnswer(v => !v)}
              className="flex items-center justify-between w-full px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-[#1C2128] transition-colors"
            >
              <div className="flex items-center gap-2">
                <Sparkles size={14} className="text-brand-500" />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Model answer</span>
              </div>
              {showModelAnswer ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
            </button>
            {showModelAnswer && (
              <div className="px-4 pb-4 border-t border-gray-100 dark:border-[#21262D] pt-3">
                <Markdown>{gradeResult.model_answer}</Markdown>
              </div>
            )}
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-2">
          <button
            onClick={resetToHome}
            className="flex-1 flex items-center justify-center gap-2 py-3 bg-teal-400 text-white text-sm font-medium rounded-xl hover:bg-teal-800 dark:hover:bg-teal-600 transition-colors active:scale-[0.98]"
          >
            <RotateCcw size={14} /> Try another question
          </button>
        </div>
      </div>
    )
  }

  // ── Write phase ──────────────────────────────────────────────────────────
  if (phase === 'write' && mode) {
    const marks = mode === '5mark' ? 5 : 10
    const modelAnswer = mode === '5mark' ? existingNote?.model_answer_5mark : existingNote?.model_answer_10mark

    return (
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-teal-50 text-teal-800">{marks} marks</span>
            <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">{topic.name}</h3>
          </div>
          <button onClick={resetToHome} className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
            ← Back
          </button>
        </div>

        {question && (
          <div className="bg-teal-50 dark:bg-teal-900/20 border border-teal-200 dark:border-teal-800/50 rounded-xl p-4 mb-4">
            <p className="text-[11px] font-semibold text-teal-700 dark:text-teal-400 uppercase tracking-wide mb-1.5">Question</p>
            <p className="text-sm text-teal-900 dark:text-teal-100 leading-relaxed">{question}</p>
          </div>
        )}

        {/* Hint — hidden until the student asks for it */}
        {questionHints.length > 0 && (
          <div className="mb-4">
            <button
              onClick={() => setShowHint(h => !h)}
              className="flex items-center gap-1.5 text-xs font-medium text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 transition-colors"
            >
              <Lightbulb size={13} />
              {showHint ? 'Hide hint' : 'Show hint'}
              {showHint ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            </button>
            {showHint && (
              <div className="mt-2 bg-amber-50 dark:bg-amber-900/15 border border-amber-200 dark:border-amber-800/50 rounded-xl p-3">
                <p className="text-[11px] font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wide mb-1.5">Key points to cover</p>
                <ul className="space-y-1">
                  {questionHints.map((h, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-amber-900 dark:text-amber-200">
                      <span className="text-amber-400 mt-0.5">•</span>
                      <span>{h}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {modelAnswer && (
          <div className="bg-gray-50 dark:bg-[#1C2128] border-l-4 border-brand-400 rounded-r-xl px-4 py-3 mb-4">
            <p className="text-[11px] font-semibold text-brand-600 dark:text-brand-400 uppercase tracking-wide mb-1">Answer structure hint</p>
            <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">{modelAnswer}</p>
          </div>
        )}

        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          rows={10}
          placeholder={`Write your ${marks}-mark answer here…\n\nTip: ${marks === 5 ? 'Aim for 3-5 clear key points. Use bullet points or numbered list.' : 'Cover all aspects with explanation. Use headings or structured points. Aim for 8-12 sentences.'}`}
          className="w-full px-4 py-3 text-sm border border-gray-200 dark:border-[#30363D] dark:bg-[#1C2128] dark:text-gray-100 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-teal-400/30 focus:border-teal-400 transition-all leading-relaxed placeholder:text-gray-400 dark:placeholder:text-gray-600"
          autoFocus
        />
        <div className="flex items-center justify-between mt-1 mb-3">
          <p className="text-xs text-gray-400 dark:text-gray-600">{text.split(/\s+/).filter(Boolean).length} words</p>
          <p className="text-xs text-gray-400 dark:text-gray-600">{text.length} chars</p>
        </div>

        <button
          onClick={submitAnswer}
          disabled={grading || !text.trim()}
          className="w-full py-3 bg-teal-400 text-white text-sm font-medium rounded-xl hover:bg-teal-800 dark:hover:bg-teal-600 transition-colors disabled:opacity-50 active:scale-[0.98]"
        >
          {grading ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 size={15} className="animate-spin" /> Grading with AI…
            </span>
          ) : 'Submit for AI grading'}
        </button>
      </div>
    )
  }

  // ── Home phase ────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Sparkles size={13} className="text-teal-400" />
          <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">Generate a practice question</p>
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          <button
            onClick={() => generateQuestion('5mark')}
            disabled={!!generatingQuestion}
            className="flex flex-col items-center gap-2 py-4 px-3 border-2 border-teal-200 dark:border-teal-800/50 bg-teal-50 dark:bg-teal-900/10 rounded-xl text-sm font-medium text-teal-800 dark:text-teal-300 hover:border-teal-400 dark:hover:border-teal-600 transition-all active:scale-[0.98] disabled:opacity-60"
          >
            {generatingQuestion === '5mark' ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <span className="text-xl font-bold">5</span>
            )}
            <span className="text-xs">{generatingQuestion === '5mark' ? 'Generating…' : '5-mark question'}</span>
          </button>
          <button
            onClick={() => generateQuestion('10mark')}
            disabled={!!generatingQuestion}
            className="flex flex-col items-center gap-2 py-4 px-3 border-2 border-teal-200 dark:border-teal-800/50 bg-teal-50 dark:bg-teal-900/10 rounded-xl text-sm font-medium text-teal-800 dark:text-teal-300 hover:border-teal-400 dark:hover:border-teal-600 transition-all active:scale-[0.98] disabled:opacity-60"
          >
            {generatingQuestion === '10mark' ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <span className="text-xl font-bold">10</span>
            )}
            <span className="text-xs">{generatingQuestion === '10mark' ? 'Generating…' : '10-mark question'}</span>
          </button>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-gray-200 dark:bg-[#30363D]" />
        <span className="text-xs text-gray-400">or use a real exam question</span>
        <div className="flex-1 h-px bg-gray-200 dark:bg-[#30363D]" />
      </div>

      <div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*,.pdf"
          onChange={handleFileUpload}
          className="hidden"
          id="p2-file-upload"
        />

        {question ? (
          <div className="bg-teal-50 dark:bg-teal-900/20 border border-teal-200 dark:border-teal-800/50 rounded-xl p-4">
            <div className="flex items-start justify-between gap-2 mb-2">
              <p className="text-[11px] font-semibold text-teal-700 dark:text-teal-400 uppercase tracking-wide">Extracted question</p>
              <button onClick={() => setQuestion('')} className="text-teal-500 hover:text-teal-700 transition-colors flex-shrink-0">
                <X size={14} />
              </button>
            </div>
            <p className="text-sm text-teal-900 dark:text-teal-200 whitespace-pre-wrap leading-relaxed mb-3">{question}</p>
            <div className="flex gap-2">
              <button
                onClick={() => { setMode('5mark'); setPhase('write') }}
                className="flex-1 py-2 text-xs font-medium bg-teal-600 text-white rounded-lg hover:bg-teal-800 transition-colors"
              >
                Write 5-mark answer
              </button>
              <button
                onClick={() => { setMode('10mark'); setPhase('write') }}
                className="flex-1 py-2 text-xs font-medium bg-teal-600 text-white rounded-lg hover:bg-teal-800 transition-colors"
              >
                Write 10-mark answer
              </button>
            </div>
          </div>
        ) : (
          <label
            htmlFor="p2-file-upload"
            className={cn(
              'flex items-center gap-3 w-full px-4 py-3.5 border-2 border-dashed rounded-xl cursor-pointer transition-all duration-150',
              extracting
                ? 'border-brand-400 bg-brand-50 dark:bg-brand-900/20'
                : 'border-gray-200 dark:border-[#30363D] hover:border-teal-400 hover:bg-teal-50 dark:hover:bg-teal-900/10'
            )}
          >
            {extracting
              ? <Loader2 size={18} className="text-brand-600 animate-spin flex-shrink-0" />
              : <FileImage size={18} className="text-gray-400 flex-shrink-0" />}
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {extracting ? 'Reading question from image…' : 'Upload past paper question (image or PDF)'}
            </span>
          </label>
        )}
      </div>

      {/* Previous attempts */}
      {answers.length > 0 && (
        <div>
          <button
            onClick={() => setShowHistory(h => !h)}
            className="flex items-center justify-between w-full text-xs font-medium text-gray-500 dark:text-gray-400 py-2"
          >
            <span>Previous attempts ({answers.length})</span>
            {showHistory ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>

          {showHistory && (
            <div className="space-y-3 mt-2">
              {answers.map(a => {
                const maxMark = a.question_type === '5mark' ? 5 : 10
                const score = a.ai_score ?? 0
                const isPassing = score >= maxMark * 0.6
                return (
                  <div key={a.id} className="border border-gray-200 dark:border-[#30363D] rounded-xl p-4 dark:bg-[#161B22]">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-gray-400 dark:text-gray-500">
                        {a.question_type} · {new Date(a.attempted_at).toLocaleDateString()}
                      </span>
                      {a.ai_score != null && (
                        <span className={cn(
                          'text-xs font-semibold px-2 py-0.5 rounded-full',
                          isPassing ? 'bg-success-50 text-success-800' : 'bg-warning-50 text-warning-800'
                        )}>
                          {a.ai_score}/{maxMark}
                        </span>
                      )}
                    </div>
                    {a.question_text && (
                      <p className="text-xs text-gray-500 dark:text-gray-500 mb-2 italic line-clamp-2">
                        Q: {a.question_text}
                      </p>
                    )}
                    {a.ai_feedback && <Markdown compact>{a.ai_feedback}</Markdown>}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
