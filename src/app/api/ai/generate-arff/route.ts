import { NextResponse } from 'next/server'
import { groqJSON } from '@/lib/groq'
import { ARFF_CATEGORIES } from '@/lib/constants'

export async function POST(req: Request) {
  const { category, count } = await req.json()

  const picked = category === 'random'
    ? ARFF_CATEGORIES[Math.floor(Math.random() * ARFF_CATEGORIES.length)]
    : ARFF_CATEGORIES.find(c => c.id === category)

  const system = `You are a CAAN ARFF exam question writer for the Nepal Level 5 Senior Assistant exam (Aviation Fire Services Group).

Generate practical, exam-focused MCQs on ARFF/aviation fire fighting topics. Include:
- Specific foam concentrations, flow rates, response times from ICAO/CAAN standards
- ICAO Annex 14 requirements for aerodrome category
- RFFS vehicle specifications
- Fire class types and appropriate agents
- Nepal CAAN Civil Aviation Requirements (CAR)

Return JSON:
{
  "questions": [
    {
      "question_text": "...",
      "options": {"A": "...", "B": "...", "C": "...", "D": "..."},
      "correct_answer": "A",
      "explanation": "with specific standard/regulation reference",
      "difficulty": "easy|medium|hard"
    }
  ]
}`

  try {
    const data = await groqJSON<{ questions: unknown[] }>([
      { role: 'system', content: system },
      {
        role: 'user',
        content: `Generate ${count ?? 10} ARFF MCQs on: "${picked?.label ?? 'General ARFF'}". Focus on exam-critical specifics: numbers, thresholds, procedures.`,
      },
    ])
    return NextResponse.json(data)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 })
  }
}
