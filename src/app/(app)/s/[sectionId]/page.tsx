import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { TOPIC_WITH_PROGRESS, flattenTopics } from '@/lib/topics'
import { GKClient } from '@/components/gk/GKClient'
import { IQClient } from '@/components/iq/IQClient'
import { ARFFClient } from '@/components/arff/ARFFClient'

export default async function SectionPage({ params }: { params: Promise<{ sectionId: string }> }) {
  const { sectionId } = await params
  const supabase = await createClient()

  const { data: section } = await supabase.from('exam_sections').select('*').eq('id', sectionId).maybeSingle()
  if (!section) notFound()

  const [{ data: rawTopics }, { data: keyPoints }, { data: userSrcs }] = await Promise.all([
    supabase.from('topics').select(TOPIC_WITH_PROGRESS).eq('section_id', sectionId).order('topic_number'),
    supabase.from('topic_notes').select('topic_id,key_points'),
    supabase.from('user_topic_sources').select('topic_id'),
  ])
  // Topics where the current user has added their own source material — used to highlight them in lists.
  const userSourceTopicIds = new Set((userSrcs ?? []).map(s => s.topic_id))
  const topics = flattenTopics(rawTopics).map(t => ({ ...t, has_user_source: userSourceTopicIds.has(t.id) }))
  const topicIds = new Set(topics.map(t => t.id))
  const tkp = (keyPoints ?? []).filter(kp => topicIds.has(kp.topic_id))

  if (section.kind === 'mcq_study') {
    return <GKClient topics={topics} topicKeyPoints={tkp} heading={section.name} sectionId={sectionId} />
  }

  if (section.kind === 'written') {
    const { data: answers } = await supabase
      .from('p2_answers').select('*,topics(name)')
      .order('attempted_at', { ascending: false }).limit(200)
    return <ARFFClient p2Topics={topics} p2Answers={answers ?? []} topicKeyPoints={tkp} heading={section.name} />
  }

  // aptitude
  const [{ data: stats }, { data: attempts }] = await Promise.all([
    supabase.from('iq_stats').select('*'),
    supabase.from('iq_attempts').select('is_correct,confidence,time_taken_s').order('attempted_at', { ascending: false }).limit(100),
  ])
  const withAttempts = (stats ?? []).filter(s => s.total_attempted > 0)
  const totalAttempted = (stats ?? []).reduce((s, r) => s + r.total_attempted, 0)
  const avgAccuracy = withAttempts.length ? Math.round(withAttempts.reduce((s, r) => s + r.accuracy_pct, 0) / withAttempts.length) : 0
  const times = (attempts ?? []).map(a => a.time_taken_s).filter(Boolean) as number[]
  const avgTime = times.length ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : 0

  return (
    <IQClient
      stats={stats ?? []}
      totalAttempted={totalAttempted}
      avgAccuracy={avgAccuracy}
      avgTime={avgTime}
      topics={topics}
      topicKeyPoints={tkp}
      heading={section.name}
      sectionId={sectionId}
    />
  )
}
