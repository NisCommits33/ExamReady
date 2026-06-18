import { NextResponse } from 'next/server'
import { groqStream } from '@/lib/groq'
import { logActivity } from '@/lib/activity'
import { getExamPromptContext } from '@/lib/exam'

export async function POST(req: Request) {
  const { topicId, topicName, paper, section, subsections, subtopicName } = await req.json()
  const examCtx = await getExamPromptContext()
  const focused = !!subtopicName

  const systemPrompt = focused
    ? `You are an expert study note writer for the ${examCtx} exam.

Write a FOCUSED study note on the single subtopic "${subtopicName}" (part of the broader topic "${topicName}"). Cover only this subtopic in depth — do not drift into sibling subtopics.

Structure:
1. DEFINITION: 1-2 sentence definition of this subtopic
2. CORE CONTENT: The key facts, with relevant numbers, dates, thresholds
3. DIAGRAM (optional): one small mermaid diagram if it genuinely helps (fenced \`\`\`mermaid block, max 8 nodes)
4. KEY NUMBERS & DATES: bullet list of figures to memorize
5. EXAM TRAPS: 1-2 common MCQ traps for this subtopic
6. KEYWORDS: comma-separated key terms

Write in clear English. Be specific. Target length: 300-500 words.`
    : `You are an expert study note writer for the ${examCtx} exam.

Generate a comprehensive study note. Structure it as follows:

1. DEFINITION: A clear 2-3 sentence definition
2. CORE CONTENT: Cover all subsections with headers. Use plain language. Include relevant numbers, dates, thresholds.
3. DIAGRAMS: Include 1-2 mermaid diagrams where helpful to visualize concepts. Use fenced code blocks with the language "mermaid". Good uses:
   - Flowcharts for procedures/decision trees
   - Hierarchies for classifications (e.g. fire classes, equipment types)
   - Sequence diagrams for step-by-step processes
   Example format:
   \`\`\`mermaid
   graph TD
     A[Start] --> B[Step 1]
     B --> C[Step 2]
   \`\`\`
4. REAL-WORLD CONTEXT: Ground at least 2 examples in practical, real-world scenarios relevant to this exam's field
5. KEY NUMBERS & DATES: Bullet list of important figures, years, thresholds to memorize
6. EXAM TRAPS: 2-3 common MCQ traps and confusing terms for this topic
7. PAPER 2 HINT: How to structure a 5-mark and 10-mark answer on this topic
8. KEYWORDS: Comma-separated list of 6-10 key terms

Write in clear English. Be specific. Target length: 700-1000 words.
For regulations and acts, include specific section numbers and provisions.
Keep mermaid diagrams simple and readable — max 8-10 nodes per diagram.`

  logActivity('generate_note', topicId, { topic: topicName, paper, subtopic: subtopicName ?? null })

  const userContent = focused
    ? `Generate a focused study note for the subtopic: ${subtopicName}\nParent topic: ${topicName}`
    : `Generate study note for: ${topicName}\nPaper: ${paper}, Section: ${section}\nSubsections: ${(subsections ?? []).join(', ')}`

  try {
    const stream = await groqStream([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userContent },
    ])

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 })
  }
}
