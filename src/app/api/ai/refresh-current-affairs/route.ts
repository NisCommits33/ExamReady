import { NextResponse } from 'next/server'
import { groqJSON } from '@/lib/groq'
import { createClient } from '@/lib/supabase/server'
import { getExamPromptContext } from '@/lib/exam'
import { logActivity } from '@/lib/activity'

export async function POST(req: Request) {
  const { subtopicId, digest } = await req.json()
  if (!subtopicId) return NextResponse.json({ error: 'Missing subtopicId' }, { status: 400 })

  const supabase = await createClient()
  const { data: subtopic } = await supabase
    .from('subtopics')
    .select('name, topics(name)')
    .eq('id', subtopicId)
    .maybeSingle()
  if (!subtopic) return NextResponse.json({ error: 'Subtopic not found' }, { status: 404 })

  const examCtx = await getExamPromptContext()
  const today = new Date().toISOString().split('T')[0]
  const hasDigest = typeof digest === 'string' && digest.trim().length > 0

  const system = `You write a concise current-affairs study capsule for the ${examCtx} exam, as of ${today}.

${hasDigest
  ? 'Base the capsule ONLY on the provided digest of recent events. Do not invent facts not in the digest.'
  : 'Summarize the most exam-relevant recent developments you are confident about. Clearly avoid fabricating specific dates or figures you are unsure of.'}

Return JSON:
{
  "study_note": "markdown capsule grouped by area (Politics, Economy, International, Science/Tech, Sports, Awards). Bullet points with the fact + why it matters. Include dates where known.",
  "key_points": "a tight bullet reference card of the most memorizable facts (names, dates, numbers), grouped with ## headers."
}`

  try {
    const data = await groqJSON<{ study_note: string; key_points: string }>([
      { role: 'system', content: system },
      { role: 'user', content: `Subtopic: ${subtopic.name}\nAs of: ${today}${hasDigest ? `\n\nRecent digest:\n${String(digest).slice(0, 6000)}` : ''}` },
    ])

    await supabase.from('subtopics').update({
      study_note: data.study_note,
      key_points: data.key_points,
      generated_at: new Date().toISOString(),
    }).eq('id', subtopicId)

    logActivity('refresh_current_affairs', null, { subtopicId, grounded: hasDigest })
    return NextResponse.json(data)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 })
  }
}
