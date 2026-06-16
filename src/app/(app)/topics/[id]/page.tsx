import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { TopicReaderClient } from '@/components/topics/TopicReaderClient'

export default async function TopicReaderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const [{ data: topic }, { data: note }, { data: annotations }, { data: answers }] = await Promise.all([
    supabase.from('topics').select('*').eq('id', id).single(),
    supabase.from('topic_notes').select('*').eq('topic_id', id).maybeSingle(),
    supabase.from('user_annotations').select('*').eq('topic_id', id).order('created_at', { ascending: false }),
    supabase.from('p2_answers').select('*').eq('topic_id', id).order('attempted_at', { ascending: false }).limit(5),
  ])

  if (!topic) notFound()

  return (
    <TopicReaderClient
      topic={topic}
      note={note}
      annotations={annotations ?? []}
      answers={answers ?? []}
    />
  )
}
