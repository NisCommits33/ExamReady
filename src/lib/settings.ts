import { createClient } from '@/lib/supabase/client'

export async function getExamDate(): Promise<string> {
  const supabase = createClient()
  const { data } = await supabase.from('user_settings').select('value').eq('key', 'exam_date').single()
  return data?.value ?? '2025-08-13'
}

export async function setExamDate(date: string): Promise<void> {
  const supabase = createClient()
  await supabase.from('user_settings').upsert({ key: 'exam_date', value: date })
}
