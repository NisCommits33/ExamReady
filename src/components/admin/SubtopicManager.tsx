'use client'

import { useEffect, useState } from 'react'
import { Loader2, Plus, Trash2, ChevronUp, ChevronDown, RefreshCw, Sparkles, Check, Pencil } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import { notifyTokens, tokensFromRes } from '@/lib/notify-tokens'

interface Sub { id: string; name: string; sort_order: number; is_dynamic: boolean }
type SuggestMode = 'headings' | 'source' | 'note' | 'general'

const SUGGEST_MODES: { value: SuggestMode; label: string }[] = [
  { value: 'headings', label: 'Source headings' },
  { value: 'source', label: 'AI: source' },
  { value: 'note', label: 'AI: note' },
  { value: 'general', label: 'AI: general' },
]

async function api(body: Record<string, unknown>) {
  const res = await fetch('/api/admin/subtopics', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) { toast.error(json.error ?? 'Failed'); return null }
  return json
}

export function SubtopicManager({ topicId, topicName }: { topicId: string; topicName: string }) {
  const confirm = useConfirm()
  const [rows, setRows] = useState<Sub[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [name, setName] = useState('')
  const [bulk, setBulk] = useState('')
  const [editId, setEditId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())

  // Suggest
  const [mode, setMode] = useState<SuggestMode>('headings')
  const [suggesting, setSuggesting] = useState(false)
  const [proposed, setProposed] = useState<string[] | null>(null)
  const [picked, setPicked] = useState<Set<string>>(new Set())

  async function load() {
    setLoading(true)
    const json = await api({ action: 'list', topicId })
    setRows(json?.subtopics ?? [])
    setSelected(new Set())
    setLoading(false)
  }
  useEffect(() => { load() }, [topicId])

  function toggleSel(id: string) {
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }
  async function deleteSelected() {
    const ids = [...selected]
    if (ids.length === 0) return
    if (!(await confirm({ title: `Delete ${ids.length} subtopic${ids.length > 1 ? 's' : ''}?`, message: 'Selected subtopics and their notes will be removed.', confirmLabel: 'Delete', danger: true }))) return
    if (await run({ action: 'deleteMany', ids }, `Deleted ${ids.length}`)) setSelected(new Set())
  }
  async function deleteAll() {
    if (rows.length === 0) return
    if (!(await confirm({ title: `Delete all ${rows.length} subtopics?`, message: 'Every subtopic for this topic will be permanently removed.', confirmLabel: 'Delete all', danger: true }))) return
    await run({ action: 'deleteAll', topicId }, 'All subtopics deleted')
  }

  async function run(body: Record<string, unknown>, ok?: string) {
    setBusy(true)
    const json = await api(body)
    setBusy(false)
    if (json) { if (ok) toast.success(ok); await load() }
    return !!json
  }

  async function suggest() {
    setSuggesting(true); setProposed(null)
    const res = await fetch('/api/ai/suggest-subtopics', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topicId, topicName, mode }),
    })
    const json = await res.json().catch(() => ({}))
    setSuggesting(false)
    if (mode !== 'headings') notifyTokens(tokensFromRes(res))
    if (!res.ok) { toast.error(json.error ?? 'Failed'); return }
    const existing = new Set(rows.map(r => r.name.toLowerCase()))
    const names = (json.subtopics ?? []).filter((n: string) => !existing.has(n.toLowerCase()))
    if (names.length === 0) { toast.info(json.error ?? 'No new subtopics found'); return }
    setProposed(names)
    setPicked(new Set(names))
  }

  async function addPicked() {
    const names = [...picked]
    if (names.length === 0) return
    if (await run({ action: 'addMany', topicId, names }, `Added ${names.length}`)) { setProposed(null); setPicked(new Set()) }
  }

  function move(i: number, dir: -1 | 1) {
    const j = i + dir
    if (j < 0 || j >= rows.length) return
    const next = [...rows]
    ;[next[i], next[j]] = [next[j], next[i]]
    setRows(next)
    run({ action: 'reorder', ids: next.map(r => r.id) })
  }

  return (
    <div className="mt-2 border border-gray-200 dark:border-[#30363D] rounded-lg p-2.5 bg-gray-50 dark:bg-[#0D1117] space-y-3">
      {/* List */}
      {loading ? (
        <Loader2 size={14} className="animate-spin text-gray-400 mx-auto my-2" />
      ) : rows.length === 0 ? (
        <p className="text-[11px] text-gray-400">No subtopics yet.</p>
      ) : (
        <div className="space-y-1">
          <div className="flex items-center gap-2 pb-1 mb-0.5 border-b border-gray-200 dark:border-[#21262D]">
            <input type="checkbox" checked={selected.size === rows.length} onChange={() => setSelected(selected.size === rows.length ? new Set() : new Set(rows.map(r => r.id)))} className="accent-brand-600" />
            <span className="text-[11px] text-gray-400 flex-1">Select all</span>
            {selected.size > 0 && (
              <button onClick={deleteSelected} className="inline-flex items-center gap-1 text-[11px] font-medium text-white bg-red-600 px-2 py-0.5 rounded hover:bg-red-700"><Trash2 size={11} /> Delete ({selected.size})</button>
            )}
            <button onClick={deleteAll} className="text-[11px] font-medium text-red-600 hover:underline">Delete all</button>
          </div>
          {rows.map((s, i) => (
            <div key={s.id} className="flex items-center gap-2 text-xs">
              <input type="checkbox" checked={selected.has(s.id)} onChange={() => toggleSel(s.id)} className="accent-brand-600 flex-shrink-0" />
              <div className="flex flex-col">
                <button onClick={() => move(i, -1)} disabled={i === 0 || busy} className="text-gray-300 hover:text-gray-600 disabled:opacity-30"><ChevronUp size={11} /></button>
                <button onClick={() => move(i, 1)} disabled={i === rows.length - 1 || busy} className="text-gray-300 hover:text-gray-600 disabled:opacity-30"><ChevronDown size={11} /></button>
              </div>
              {editId === s.id ? (
                <input
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { run({ action: 'rename', id: s.id, name: editName }); setEditId(null) } }}
                  autoFocus
                  className="flex-1 text-xs border border-gray-200 dark:border-[#30363D] dark:bg-[#1C2128] rounded px-1.5 py-1 focus:outline-none"
                />
              ) : (
                <span className="flex-1 text-gray-700 dark:text-gray-300 truncate">{s.name}</span>
              )}
              <button onClick={() => run({ action: 'setDynamic', id: s.id, isDynamic: !s.is_dynamic })} title="Dynamic (current affairs)" className={cn('p-0.5 rounded', s.is_dynamic ? 'text-brand-500' : 'text-gray-300 hover:text-brand-500')}><RefreshCw size={12} /></button>
              {editId === s.id ? (
                <button onClick={() => { run({ action: 'rename', id: s.id, name: editName }); setEditId(null) }} className="text-success-600"><Check size={13} /></button>
              ) : (
                <button onClick={() => { setEditId(s.id); setEditName(s.name) }} className="text-gray-300 hover:text-brand-600"><Pencil size={12} /></button>
              )}
              <button
                onClick={async () => { if (await confirm({ title: 'Delete subtopic?', message: `"${s.name}" and its notes will be removed.`, confirmLabel: 'Delete', danger: true })) run({ action: 'delete', id: s.id }) }}
                className="text-gray-300 hover:text-red-500"
              ><Trash2 size={12} /></button>
            </div>
          ))}
        </div>
      )}

      {/* Add single */}
      <div className="flex items-center gap-1.5">
        <input value={name} onChange={e => setName(e.target.value)} placeholder="New subtopic name" className="flex-1 text-xs border border-gray-200 dark:border-[#30363D] dark:bg-[#1C2128] rounded-md px-2 py-1.5 focus:outline-none" />
        <button
          onClick={async () => { if (name.trim() && await run({ action: 'add', topicId, name }, 'Added')) setName('') }}
          disabled={busy || !name.trim()}
          className="inline-flex items-center gap-1 text-xs font-medium text-white bg-brand-600 px-2 py-1.5 rounded-md hover:bg-brand-800 disabled:opacity-40"
        ><Plus size={12} /> Add</button>
      </div>

      {/* Bulk */}
      <details>
        <summary className="text-[11px] text-gray-500 cursor-pointer">Bulk paste (one name per line)</summary>
        <textarea value={bulk} onChange={e => setBulk(e.target.value)} rows={4} placeholder={'Rivers\nMountains\nLakes'} className="mt-1.5 w-full text-xs border border-gray-200 dark:border-[#30363D] dark:bg-[#1C2128] rounded-md p-2 resize-y focus:outline-none" />
        <button onClick={async () => { if (await run({ action: 'addMany', topicId, names: bulk }, 'Imported')) setBulk('') }} disabled={busy || !bulk.trim()} className="mt-1.5 text-xs font-medium text-white bg-brand-600 px-2.5 py-1.5 rounded-md hover:bg-brand-800 disabled:opacity-40">Import list</button>
      </details>

      {/* Suggest */}
      <div className="border-t border-gray-200 dark:border-[#21262D] pt-2.5">
        <div className="flex flex-wrap items-center gap-1.5 mb-2">
          <span className="text-[11px] text-gray-500">Suggest from:</span>
          {SUGGEST_MODES.map(o => (
            <button key={o.value} onClick={() => setMode(o.value)} className={cn('text-[11px] px-2 py-1 rounded-md border', mode === o.value ? 'bg-brand-600 text-white border-brand-600' : 'border-gray-200 dark:border-[#30363D] text-gray-500')}>{o.label}</button>
          ))}
          <button onClick={suggest} disabled={suggesting} className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 border border-brand-200 dark:border-brand-800 px-2 py-1 rounded-md hover:bg-brand-50 dark:hover:bg-brand-900/20 disabled:opacity-40">
            {suggesting ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />} Suggest
          </button>
        </div>
        {proposed && (
          <div className="space-y-1.5">
            <div className="flex flex-wrap gap-1.5">
              {proposed.map(n => {
                const on = picked.has(n)
                return (
                  <button key={n} onClick={() => setPicked(p => { const s = new Set(p); s.has(n) ? s.delete(n) : s.add(n); return s })}
                    className={cn('text-[11px] px-2 py-1 rounded-full border transition-colors', on ? 'bg-brand-50 dark:bg-brand-900/20 border-brand-300 dark:border-brand-700 text-brand-700 dark:text-brand-300' : 'border-gray-200 dark:border-[#30363D] text-gray-500')}>
                    {on && <Check size={10} className="inline mr-0.5" />}{n}
                  </button>
                )
              })}
            </div>
            <button onClick={addPicked} disabled={busy || picked.size === 0} className="text-xs font-medium text-white bg-brand-600 px-2.5 py-1.5 rounded-md hover:bg-brand-800 disabled:opacity-40">Add selected ({picked.size})</button>
          </div>
        )}
      </div>
    </div>
  )
}
