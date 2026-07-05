import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { TopicReaderClient } from '@/components/topics/TopicReaderClient'
import { TOPIC_WITH_PROGRESS, flattenTopic } from '@/lib/topics'

export default async function TopicReaderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const [{ data: rawTopic }, { data: note }, { data: annotations }, { data: progress }] = await Promise.all([
    supabase.from('topics').select(TOPIC_WITH_PROGRESS).eq('id', id).single(),
    supabase.from('topic_notes').select('*').eq('topic_id', id).maybeSingle(),
    supabase.from('user_annotations').select('*').eq('topic_id', id).order('created_at', { ascending: false }),
    supabase.from('user_topic_progress').select('last_read_tab,last_read_scroll').eq('topic_id', id).maybeSingle(),
  ])

  if (!rawTopic) notFound()
  const topic = flattenTopic(rawTopic)

  return (
    <TopicReaderClient
      topic={topic}
      note={note}
      annotations={annotations ?? []}
      resume={progress ?? null}
    />
  )
}
