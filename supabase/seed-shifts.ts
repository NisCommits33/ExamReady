import { createClient } from '@supabase/supabase-js'
import { resolve } from 'path'
import { config } from 'dotenv'

config({ path: resolve(__dirname, '../.env.local') })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
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
    })
  }

  const { error } = await supabase.from('shifts').upsert(shifts, { onConflict: 'date' })
  if (error) { console.error('Shift seed error:', error); process.exit(1) }
  console.log(`✓ Seeded ${shifts.length} shifts`)
}

seedShifts()
