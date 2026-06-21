// Shared MCQ types + import parsing/validation (used by the admin client preview and the import API).

export type Choice = 'A' | 'B' | 'C' | 'D'
export type Difficulty = 'easy' | 'medium' | 'hard'

/** Normalised question ready to insert / drill. */
export interface McqRow {
  question: string
  options: Record<Choice, string>
  correct: Choice
  explanation: string
  difficulty: Difficulty
}

/** Shape the drill UI consumes. */
export interface DrillQuestion {
  question: string
  options: Record<string, string>
  correct: string
  explanation: string
  trap: string
}

export interface ParseResult {
  rows: McqRow[]
  errors: string[]
}

const CHOICES: Choice[] = ['A', 'B', 'C', 'D']

/**
 * Randomly permutes a question's A–D options and remaps `correct` accordingly,
 * so the answer isn't always in the same slot. Index-based (safe with duplicate option text).
 */
export function shuffleQuestion<T extends { options: Record<string, string>; correct: string }>(q: T): T {
  const letters: Choice[] = ['A', 'B', 'C', 'D']
  const values = letters.map(l => q.options[l])
  const correctIdx = letters.indexOf(q.correct as Choice)

  const order = [0, 1, 2, 3]
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[order[i], order[j]] = [order[j], order[i]]
  }

  const options: Record<string, string> = {}
  let correct = q.correct
  order.forEach((origIdx, pos) => {
    options[letters[pos]] = values[origIdx]
    if (origIdx === correctIdx) correct = letters[pos]
  })
  return { ...q, options, correct }
}
const DIFFS: Difficulty[] = ['easy', 'medium', 'hard']

export const CSV_TEMPLATE =
  'question,A,B,C,D,correct,explanation,difficulty\n' +
  '"What is the capital of Nepal?","Kathmandu","Pokhara","Lalitpur","Biratnagar","A","Kathmandu is the capital.","easy"'

export const JSON_TEMPLATE = JSON.stringify(
  [{ question: 'What is the capital of Nepal?', options: { A: 'Kathmandu', B: 'Pokhara', C: 'Lalitpur', D: 'Biratnagar' }, correct: 'A', explanation: 'Kathmandu is the capital.', difficulty: 'easy' }],
  null, 2,
)

function validateRow(raw: unknown, i: number): { row?: McqRow; error?: string } {
  const r = raw as Record<string, unknown>
  const question = String(r.question ?? '').trim()
  if (!question) return { error: `Row ${i + 1}: missing question` }

  const opt = (r.options ?? r) as Record<string, unknown>
  const options = {
    A: String(opt.A ?? '').trim(),
    B: String(opt.B ?? '').trim(),
    C: String(opt.C ?? '').trim(),
    D: String(opt.D ?? '').trim(),
  }
  if (!options.A || !options.B || !options.C || !options.D) return { error: `Row ${i + 1}: needs all four options A–D` }

  const correct = String(r.correct ?? '').trim().toUpperCase() as Choice
  if (!CHOICES.includes(correct)) return { error: `Row ${i + 1}: "correct" must be A, B, C or D` }

  const difficultyRaw = String(r.difficulty ?? 'medium').trim().toLowerCase()
  const difficulty = (DIFFS.includes(difficultyRaw as Difficulty) ? difficultyRaw : 'medium') as Difficulty

  return { row: { question, options, correct, explanation: String(r.explanation ?? '').trim(), difficulty } }
}

/** Minimal RFC-4180-ish CSV line splitter (handles quotes + escaped quotes). */
function splitCsvLine(line: string): string[] {
  const out: string[] = []
  let cur = '', inQ = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (inQ) {
      if (c === '"') { if (line[i + 1] === '"') { cur += '"'; i++ } else inQ = false }
      else cur += c
    } else if (c === '"') inQ = true
    else if (c === ',') { out.push(cur); cur = '' }
    else cur += c
  }
  out.push(cur)
  return out.map(s => s.trim())
}

function parseCsv(text: string): { raw: Record<string, unknown>[]; errors: string[] } {
  const lines = text.split(/\r?\n/).filter(l => l.trim())
  if (lines.length < 2) return { raw: [], errors: ['CSV needs a header row and at least one question'] }
  const header = splitCsvLine(lines[0]).map(h => h.toLowerCase())
  const idx = (name: string) => header.indexOf(name)
  const need = ['question', 'a', 'b', 'c', 'd', 'correct']
  const missing = need.filter(n => idx(n) === -1)
  if (missing.length) return { raw: [], errors: [`CSV missing columns: ${missing.join(', ')}`] }
  const raw = lines.slice(1).map(line => {
    const cells = splitCsvLine(line)
    return {
      question: cells[idx('question')],
      options: { A: cells[idx('a')], B: cells[idx('b')], C: cells[idx('c')], D: cells[idx('d')] },
      correct: cells[idx('correct')],
      explanation: idx('explanation') > -1 ? cells[idx('explanation')] : '',
      difficulty: idx('difficulty') > -1 ? cells[idx('difficulty')] : 'medium',
    }
  })
  return { raw, errors: [] }
}

/** Parse pasted JSON or CSV into normalised rows + per-row errors. */
export function parseMcqInput(text: string, format: 'json' | 'csv'): ParseResult {
  let raw: Record<string, unknown>[] = []
  const errors: string[] = []

  if (format === 'json') {
    try {
      const parsed = JSON.parse(text)
      if (!Array.isArray(parsed)) return { rows: [], errors: ['JSON must be an array of question objects'] }
      raw = parsed
    } catch (e) {
      return { rows: [], errors: [`Invalid JSON: ${String(e instanceof Error ? e.message : e)}`] }
    }
  } else {
    const csv = parseCsv(text)
    if (csv.errors.length) return { rows: [], errors: csv.errors }
    raw = csv.raw
  }

  const rows: McqRow[] = []
  raw.forEach((r, i) => {
    const { row, error } = validateRow(r, i)
    if (error) errors.push(error)
    else if (row) rows.push(row)
  })
  return { rows, errors }
}
