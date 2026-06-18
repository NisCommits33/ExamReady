import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { config } from 'dotenv'

config({ path: resolve(__dirname, '../.env.local') })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
)
const SOURCES_DIR = resolve(__dirname, '../../Sources')

/**
 * Map curated source files to subtopics.
 * Each entry targets a subtopic by its parent topic_number + the subtopic name (case-insensitive).
 * Add entries as curated GK material becomes available, then run: npx tsx scripts/seed-subtopics.ts
 */
const SUBTOPIC_SOURCE_MAP: { file: string; topicNumber: string; subtopicName: string }[] = [
  // Example:
  // { file: 'GK/Nepal/rivers.md', topicNumber: '1.1', subtopicName: 'River systems' },
]

async function main() {
  if (SUBTOPIC_SOURCE_MAP.length === 0) {
    console.log('No subtopic sources mapped yet. Add entries to SUBTOPIC_SOURCE_MAP.')
    return
  }

  const { data: topics } = await supabase.from('topics').select('id, topic_number')
  const byNumber = new Map((topics ?? []).map(t => [t.topic_number, t.id]))

  let seeded = 0
  for (const entry of SUBTOPIC_SOURCE_MAP) {
    const topicId = byNumber.get(entry.topicNumber)
    if (!topicId) { console.warn(`⚠ topic ${entry.topicNumber} not found`); continue }

    let content: string
    try { content = readFileSync(resolve(SOURCES_DIR, entry.file), 'utf-8') }
    catch { console.warn(`⚠ file not found: ${entry.file}`); continue }

    const { data: sub } = await supabase
      .from('subtopics')
      .select('id')
      .eq('topic_id', topicId)
      .ilike('name', entry.subtopicName)
      .maybeSingle()
    if (!sub) { console.warn(`⚠ subtopic "${entry.subtopicName}" not found under ${entry.topicNumber}`); continue }

    const { error } = await supabase.from('subtopics').update({ official_source: content }).eq('id', sub.id)
    if (error) { console.error(`✗ ${entry.subtopicName}:`, error.message); continue }
    console.log(`✓ ${entry.topicNumber} · ${entry.subtopicName}`)
    seeded++
  }
  console.log(`\nDone: ${seeded} subtopic sources seeded`)
}

main()
