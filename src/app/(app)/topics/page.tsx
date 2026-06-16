import { createClient } from '@/lib/supabase/server'
import { TopicLibraryClient } from '@/components/topics/TopicLibraryClient'

export default async function TopicsPage() {
  const supabase = await createClient()
  const { data: topics } = await supabase
    .from('topics')
    .select('*')
    .order('paper')
    .order('section')
    .order('topic_number')

  return <TopicLibraryClient initialTopics={topics ?? []} />
}
