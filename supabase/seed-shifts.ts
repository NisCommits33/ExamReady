import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function seedShifts() {
  const shifts = []
  const start = new Date()

  for (let i = 0; i < 120; i++) {
    const date = new Date(start)
    date.setDate(start.getDate() + i)
    const type = i % 2 === 0 ? 'A' : 'B'
    shifts.push({
      date: date.toISOString().split('T')[0],
      type,
      study_start: type === 'A' ? '13:00' : '07:00',
      study_end:   type === 'A' ? '17:00' : '11:00',
    })
  }

  const { error } = await supabase.from('shifts').upsert(shifts, { onConflict: 'date' })
  if (error) { console.error('Shift seed error:', error); process.exit(1) }
  console.log(`✓ Seeded ${shifts.length} shifts`)
}

seedShifts()
