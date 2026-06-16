import { NextResponse } from 'next/server'
import { GoogleGenAI } from '@google/genai'

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
              text: `This is an exam question image from the CAAN Level 5 exam (Aviation Fire Services).
Extract the exact question text from this image.
- Include all sub-parts if any (a, b, c...)
- Include marks allocation if visible (e.g., [5 marks])
- Preserve the exact wording
- Return ONLY the question text, nothing else
- If this is a 5-mark or 10-mark question, note it at the start`
            }
          ]
        }
      ]
    })

    const questionText = response.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
    if (!questionText) return NextResponse.json({ error: 'Could not extract question' }, { status: 422 })

    return NextResponse.json({ question: questionText })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
