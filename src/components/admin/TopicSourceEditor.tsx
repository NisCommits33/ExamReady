'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { isTextFile, readSourceFile } from '@/lib/source-file'
import { useConfirm } from '@/components/ui/ConfirmDialog'

export function TopicSourceEditor({ topicId, onClose }: { topicId: string; onClose: () => void }) {
  const router = useRouter()
  const confirm = useConfirm()
  const [loading, setLoading] = useState(true)
  const [source, setSource] = useState('')
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let active = true
    ;(async () => {
      const res = await fetch('/api/admin/content', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'getTopicSource', topicId }),
      })
      const json = await res.json().catch(() => ({}))
      if (active) { setSource(json.source ?? ''); setLoading(false) }
    })()
    return () => { active = false }
  }, [topicId])

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (e.target) e.target.value = ''
    if (!file) return
    setUploading(true)
    try {
      const text = await readSourceFile(file)
      if (!text.trim()) { toast.error('File was empty'); return }
      setSource(prev => (prev.trim() ? `${prev.trim()}\n\n${text}` : text))
      toast.success(isTextFile(file) ? 'File loaded — review and save' : 'Text extracted — review and save')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not read file')
    } finally {
      setUploading(false)
    }
  }

  async function save() {
    if (!(await confirm({ title: 'Save official source?', message: 'This replaces the official source for this topic for all users and re-grounds its AI content.', confirmLabel: 'Save' }))) return
    setSaving(true)
    const res = await fetch('/api/admin/content', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'setTopicSource', topicId, source }),
    })
    const json = await res.json().catch(() => ({}))
    setSaving(false)
    if (!res.ok) { toast.error(json.error ?? 'Failed to save'); return }
    toast.success('Official source saved')
    onClose()
    router.refresh()
  }

  return (
    <div className="mt-2 border border-gray-200 dark:border-[#30363D] rounded-lg p-2.5 bg-gray-50 dark:bg-[#0D1117]">
      {loading ? (
        <div className="h-24 bg-gray-100 dark:bg-[#1C2128] rounded animate-pulse" />
      ) : (
        <>
          <input ref={fileRef} type="file" accept="image/*,.pdf,.md,.markdown,.txt,text/markdown,text/plain" onChange={handleFile} className="hidden" />
          <div className="flex items-center justify-between gap-2 mb-2">
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-600 border border-brand-200 dark:border-brand-800 px-2.5 py-1.5 rounded-md hover:bg-brand-50 dark:hover:bg-brand-900/20 disabled:opacity-50"
            >
              {uploading ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
              {uploading ? 'Reading…' : 'Upload MD / PDF / image'}
            </button>
            <span className="text-[11px] text-gray-400">or paste below</span>
          </div>
          <textarea
            value={source}
            onChange={e => setSource(e.target.value)}
            rows={10}
            placeholder="Paste the official source material (Markdown), or upload a file to extract it…"
            className="w-full text-xs font-mono text-gray-700 dark:text-gray-200 dark:bg-[#161B22] border border-gray-200 dark:border-[#30363D] rounded-md p-2 resize-y focus:outline-none focus:ring-2 focus:ring-brand-400/30"
          />
          <div className="flex justify-end gap-2 mt-2">
            <button onClick={onClose} className="text-xs text-gray-400 px-2.5 py-1.5 hover:text-gray-600">Cancel</button>
            <button
              onClick={save}
              disabled={saving || uploading}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-white bg-brand-600 px-3 py-1.5 rounded-md hover:bg-brand-800 disabled:opacity-50"
            >
              {saving && <Loader2 size={12} className="animate-spin" />} Save source
            </button>
          </div>
        </>
      )}
    </div>
  )
}
