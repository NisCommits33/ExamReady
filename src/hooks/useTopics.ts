'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { TOPIC_WITH_PROGRESS, flattenTopics } from '@/lib/topics'
import type { Topic } from '@/types/database'

export function useTopics() {
  const [topics, setTopics] = useState<Topic[]>([])
  const [loading, setLoading] = useState(true)

  async function load() {
    const supabase = createClient()
    const { data } = await supabase.from('topics').select(TOPIC_WITH_PROGRESS).order('paper').order('section').order('topic_number')
    setTopics(flattenTopics(data))
    setLoading(false)
  }

  // eslint-disable-next-line react-hooks/set-state-in-effect -- async initial load; setState runs post-await
  useEffect(() => { load() }, [])

  async function updateStatus(id: string, status: Topic['status']) {
    const supabase = createClient()
    await supabase.from('user_topic_progress').upsert({ topic_id: id, status }, { onConflict: 'user_id,topic_id' })
    setTopics(prev => prev.map(t => t.id === id ? { ...t, status } : t))
    fetch('/api/ai/replan-schedule', { method: 'POST' }).catch(() => {})
  }

  return { topics, loading, reload: load, updateStatus }
}
