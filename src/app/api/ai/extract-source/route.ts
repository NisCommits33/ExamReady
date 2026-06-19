import { NextResponse } from 'next/server'
import { GoogleGenAI } from '@google/genai'
import { logActivity } from '@/lib/activity'

export async function POST(req: Request) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf']
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: 'Only images (JPG, PNG, WebP) or PDF allowed' }, { status: 400 })
    }

    const bytes = await file.arrayBuffer()
    const base64 = Buffer.from(bytes).toString('base64')

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! })
    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: [
        {
          parts: [
            { inlineData: { data: base64, mimeType: file.type as 'image/jpeg' | 'image/png' | 'image/webp' } },
            {
              text: `This is source/reference material for a study topic.
Extract ALL of the text content from this document as clean Markdown.
- Preserve headings, lists, tables, and the original ordering
- Keep every number, date, threshold and section reference exactly as written
- Do not summarise, comment, or add anything that is not in the document
- Return ONLY the extracted content as Markdown, nothing else`
            }
          ]
        }
      ]
    })

    const text = response.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
    if (!text.trim()) return NextResponse.json({ error: 'Could not extract any text' }, { status: 422 })

    logActivity('extract_source', null, { fileType: file.type })
    return NextResponse.json({ text })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
