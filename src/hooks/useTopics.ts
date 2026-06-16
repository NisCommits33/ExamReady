'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Topic } from '@/types/database'

export function useTopics() {
  const [topics, setTopics] = useState<Topic[]>([])
  const [loading, setLoading] = useState(true)

  async function load() {
    const supabase = createClient()
    const { data } = await supabase.from('topics').select('*').order('paper').order('section').order('topic_number')
    setTopics(data ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function updateStatus(id: string, status: Topic['status']) {
    const supabase = createClient()
    await supabase.from('topics').update({ status }).eq('id', id)
    setTopics(prev => prev.map(t => t.id === id ? { ...t, status } : t))
    fetch('/api/ai/replan-schedule', { method: 'POST' }).catch(() => {})
  }

  return { topics, loading, reload: load, updateStatus }
}
