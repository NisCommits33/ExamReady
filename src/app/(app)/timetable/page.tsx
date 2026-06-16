import { createClient } from '@/lib/supabase/server'
import { TimetableClient } from '@/components/timetable/TimetableClient'
import { startOfWeek, endOfWeek, format } from 'date-fns'

export default async function TimetablePage() {
  const supabase = await createClient()
  const today = new Date()
  const weekStart = startOfWeek(today, { weekStartsOn: 1 })
  const weekEnd = endOfWeek(today, { weekStartsOn: 1 })
  const from = format(weekStart, 'yyyy-MM-dd')
  const to = format(weekEnd, 'yyyy-MM-dd')

  const [{ data: planned }, { data: shifts }, { data: sessions }] = await Promise.all([
    supabase.from('planned_sessions').select('*,topics(name,paper,section)').gte('scheduled_date', from).lte('scheduled_date', to).order('scheduled_date').order('slot_time'),
    supabase.from('shifts').select('*').gte('date', from).lte('date', to),
    supabase.from('sessions').select('*,topics(name)').gte('date', from).lte('date', to),
  ])

  return (
    <TimetableClient
      initialPlanned={planned ?? []}
      shifts={shifts ?? []}
      sessions={sessions ?? []}
      weekStartDate={from}
    />
  )
}
