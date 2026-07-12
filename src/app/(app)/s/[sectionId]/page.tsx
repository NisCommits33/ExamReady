import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { TOPIC_WITH_PROGRESS, flattenTopics } from '@/lib/topics'
import { GKClient } from '@/components/gk/GKClient'
import { IQClient } from '@/components/iq/IQClient'
import { ARFFClient } from '@/components/arff/ARFFClient'

export default async function SectionPage({ params }: { params: Promise<{ sectionId: string }> }) {
  const { sectionId } = await params
  const supabase = await createClient()

  const { data: section } = await supabase.from('exam_sections').select('id,name,kind').eq('id', sectionId).maybeSingle()
  if (!section) notFound()

  const { data: rawTopics } = await supabase
    .from('topics')
    .select(TOPIC_WITH_PROGRESS)
    .eq('section_id', sectionId)
    .order('topic_number')
  const topics = flattenTopics(rawTopics)
  const topicIds = topics.map(topic => topic.id)

  const empty = Promise.resolve({ data: [] as never[] })
  const [{ data: keyPoints }, { data: userKeyNotes }, { data: legacyUserSrcs }, { data: userSrcs }] = await Promise.all([
    topicIds.length ? supabase.from('topic_notes').select('topic_id,key_points').in('topic_id', topicIds) : empty,
    topicIds.length ? supabase.from('user_topic_key_notes').select('topic_id,content').in('topic_id', topicIds) : empty,
    topicIds.length ? supabase.from('user_topic_sources').select('topic_id').in('topic_id', topicIds) : empty,
    topicIds.length ? supabase.from('user_topic_source_files').select('topic_id').in('topic_id', topicIds) : empty,
  ])
  // Topics where the current user has added their own source material — used to highlight them in lists.
  const userSourceTopicIds = new Set([
    ...(legacyUserSrcs ?? []).map(s => s.topic_id),
    ...(userSrcs ?? []).map(s => s.topic_id),
  ])
  const topicsWithSources = topics.map(t => ({ ...t, has_user_source: userSourceTopicIds.has(t.id) }))
  const topicIdSet = new Set(topicIds)
  const keyPointsByTopic = new Map(
    (keyPoints ?? [])
      .filter(kp => topicIdSet.has(kp.topic_id))
      .map(kp => [kp.topic_id, kp.key_points]),
  )
  for (const keyNote of userKeyNotes ?? []) {
    if (topicIdSet.has(keyNote.topic_id)) keyPointsByTopic.set(keyNote.topic_id, keyNote.content)
  }
  const tkp = Array.from(keyPointsByTopic, ([topic_id, key_points]) => ({ topic_id, key_points }))

  if (section.kind === 'mcq_study') {
    return <GKClient topics={topicsWithSources} topicKeyPoints={tkp} heading={section.name} sectionId={sectionId} />
  }

  if (section.kind === 'written') {
    const { data: answers } = await supabase
      .from('p2_answers').select('*,topics(name)')
      .order('attempted_at', { ascending: false }).limit(200)
    return <ARFFClient p2Topics={topicsWithSources} p2Answers={answers ?? []} topicKeyPoints={tkp} heading={section.name} />
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
      topics={topicsWithSources}
      topicKeyPoints={tkp}
      heading={section.name}
      sectionId={sectionId}
    />
  )
}
