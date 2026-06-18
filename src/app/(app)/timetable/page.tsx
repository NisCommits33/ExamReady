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
    supabase.from('shifts').select('*,shift_types(study_start,study_end)').gte('date', from).lte('date', to),
    supabase.from('sessions').select('*,topics(name)').gte('date', from).lte('date', to),
  ])

  const flatShifts = (shifts ?? []).map(s => {
    const raw = s.shift_types as unknown
    const st = (Array.isArray(raw) ? raw[0] : raw) as { study_start: string; study_end: string } | null
    return { ...s, study_start: st?.study_start ?? '', study_end: st?.study_end ?? '' }
  })

  return (
    <TimetableClient
      initialPlanned={planned ?? []}
      shifts={flatShifts}
      sessions={sessions ?? []}
      weekStartDate={from}
    />
  )
}
