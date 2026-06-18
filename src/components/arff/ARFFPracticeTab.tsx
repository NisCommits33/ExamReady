'use client'

import { useState, useEffect } from 'react'
import { P2AnswerTab } from '@/components/topics/P2AnswerTab'
import { createClient } from '@/lib/supabase/client'
import type { Topic, TopicNote, P2Answer } from '@/types/database'

export function ARFFPracticeTab({ topic }: { topic: Topic }) {
  const [note, setNote] = useState<TopicNote | null>(null)
  const [answers, setAnswers] = useState<P2Answer[]>([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const [{ data: n }, { data: a }] = await Promise.all([
        supabase.from('topic_notes').select('*').eq('topic_id', topic.id).maybeSingle(),
        supabase.from('p2_answers').select('*').eq('topic_id', topic.id).order('attempted_at', { ascending: false }).limit(10),
      ])
      setNote(n)
      setAnswers(a ?? [])
      setLoaded(true)
    }
    load()
  }, [topic.id])

  if (!loaded) return <div className="py-8 text-center"><div className="w-5 h-5 border-2 border-gray-200 border-t-brand-600 rounded-full animate-spin mx-auto" /></div>

  return <P2AnswerTab topic={topic} answers={answers} existingNote={note} />
}
