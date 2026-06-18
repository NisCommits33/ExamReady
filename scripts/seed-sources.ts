import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { config } from 'dotenv'

config({ path: resolve(__dirname, '../.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

const SOURCES_DIR = resolve(__dirname, '../../Sources')

const SOURCE_MAP: { file: string; topicNumbers: string[]; paper: number }[] = [
  // Paper 1
  { file: 'Paper 1/Civil Aviation Act, 2015 (1959).md', topicNumbers: ['1.10'], paper: 1 },
  { file: 'Paper 1/Nepal Civil Aviation Authority Act, 2053 (1996).md', topicNumbers: ['1.11'], paper: 1 },
  { file: 'Paper 1/Civil Aviation Regulation2058.md', topicNumbers: ['1.12'], paper: 1 },
  { file: 'Paper 1/Employee Guideline.md', topicNumbers: ['1.13'], paper: 1 },
  { file: 'Paper 1/Airport Service Charge.md', topicNumbers: ['1.15'], paper: 1 },

  // Paper 2 — matched chapters
  { file: 'paper 2/Chapter 2 Level of Protection.md', topicNumbers: ['14'], paper: 2 },
  { file: 'paper 2/chapter 4 communication  Alarm.md', topicNumbers: ['15'], paper: 2 },
  { file: 'paper 2/Chapter 6 Protective Clothing.md', topicNumbers: ['6'], paper: 2 },
  { file: 'paper 2/Chapter 8 Extingushing agents.md', topicNumbers: ['8'], paper: 2 },
  { file: 'paper 2/Chapter 9 Fire Stations.md', topicNumbers: ['5'], paper: 2 },
  { file: 'paper 2/chapter 11 emergency organization.md', topicNumbers: ['13'], paper: 2 },
  { file: 'paper 2/chapter 12 Firefighting Procedures.md', topicNumbers: ['11'], paper: 2 },

  // Paper 2 — new topics (chapter → new topic number)
  { file: 'paper 2/chapter  1 General Considerations.md', topicNumbers: ['20'], paper: 2 },
  { file: 'paper 2/chapter 3 Airport Facilities.md', topicNumbers: ['21'], paper: 2 },
  { file: 'paper 2/Chapter 5 vehicle Specification.md', topicNumbers: ['22'], paper: 2 },
  { file: 'paper 2/Chapter 7 Amublance medical.md', topicNumbers: ['23'], paper: 2 },
  { file: 'paper 2/Chapter 10 Personnel.md', topicNumbers: ['24'], paper: 2 },
  { file: 'paper 2/Chapter 13 difficult environments.md', topicNumbers: ['25'], paper: 2 },
  { file: 'paper 2/Chapter 14 traning.md', topicNumbers: ['26'], paper: 2 },
  { file: 'paper 2/chapter 15 Fueling Practise.md', topicNumbers: ['27'], paper: 2 },
  { file: 'paper 2/Chapter 16 Availability Information.md', topicNumbers: ['28'], paper: 2 },
  { file: 'paper 2/Chapter 17 preventive maintenance.md', topicNumbers: ['29'], paper: 2 },
  { file: 'paper 2/Chapter 18 Human factors.md', topicNumbers: ['30'], paper: 2 },
]

async function main() {
  console.log('Fetching topics…')
  const { data: topics, error } = await supabase
    .from('topics')
    .select('id, name, paper, topic_number')

  if (error || !topics) {
    console.error('Failed to fetch topics:', error)
    process.exit(1)
  }

  let seeded = 0
  let skipped = 0

  for (const entry of SOURCE_MAP) {
    const filePath = resolve(SOURCES_DIR, entry.file)
    let content: string
    try {
      content = readFileSync(filePath, 'utf-8')
    } catch {
      console.warn(`⚠ File not found: ${entry.file}`)
      continue
    }

    console.log(`\nProcessing: ${entry.file} (${content.length} chars)`)

    for (const topicNum of entry.topicNumbers) {
      const topic = topics.find(t => t.topic_number === topicNum && t.paper === entry.paper)
      if (!topic) {
        console.warn(`  ⚠ Topic ${topicNum} (paper ${entry.paper}) not found`)
        continue
      }

      const { data: existing } = await supabase
        .from('topic_notes')
        .select('id, official_source')
        .eq('topic_id', topic.id)
        .maybeSingle()

      if (existing?.official_source) {
        console.log(`  ⊘ Already seeded: ${topicNum} — ${topic.name}`)
        skipped++
        continue
      }

      if (existing) {
        await supabase.from('topic_notes').update({ official_source: content }).eq('id', existing.id)
      } else {
        await supabase.from('topic_notes').insert({ topic_id: topic.id, official_source: content })
      }
      console.log(`  ✓ Seeded: ${topicNum} — ${topic.name}`)
      seeded++
    }
  }

  console.log(`\nDone: ${seeded} seeded, ${skipped} skipped`)
}

main()
