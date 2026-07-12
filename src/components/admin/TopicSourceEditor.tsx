'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { readMarkdownFile } from '@/lib/markdown-file'
import { SOURCE_LANGUAGES, SOURCE_LANGUAGE_STORAGE_KEY, sourceLanguageLabel, type SourceLanguage } from '@/lib/language'
import { queueRagIngestion } from '@/lib/rag-client'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import { cn } from '@/lib/utils'

type SourceContent = Partial<Record<SourceLanguage, { content: string; file_name: string | null }>>

export function TopicSourceEditor({ topicId, onClose }: { topicId: string; onClose: () => void }) {
  const router = useRouter()
  const confirm = useConfirm()
  const [loading, setLoading] = useState(true)
  const [language, setLanguage] = useState<SourceLanguage>(() => {
    if (typeof window === 'undefined') return 'en'
    const stored = window.localStorage.getItem(SOURCE_LANGUAGE_STORAGE_KEY)
    return stored === 'en' || stored === 'ne' ? stored : 'en'
  })
  const [sources, setSources] = useState<SourceContent>({})
  const [source, setSource] = useState('')
  const [fileName, setFileName] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let active = true
    ;(async () => {
      const res = await fetch('/api/admin/content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'getTopicSource', topicId }),
      })
      const json = await res.json().catch(() => ({}))
      if (!active) return
      const nextSources = (json.sources ?? {}) as SourceContent
      setSources(nextSources)
      const selected = nextSources[language]
      setSource(selected?.content ?? '')
      setFileName(selected?.file_name ?? null)
      setLoading(false)
    })()
    return () => { active = false }
  }, [topicId, language])

  function selectLanguage(next: SourceLanguage) {
    setLanguage(next)
    window.localStorage.setItem(SOURCE_LANGUAGE_STORAGE_KEY, next)
    const selected = sources[next]
    setSource(selected?.content ?? '')
    setFileName(selected?.file_name ?? null)
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (e.target) e.target.value = ''
    if (!file) return
    setUploading(true)
    try {
      const text = await readMarkdownFile(file)
      if (!text.trim()) { toast.error('File was empty'); return }
      setSource(text)
      setFileName(file.name)
      toast.success('Markdown file loaded')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not read file')
    } finally {
      setUploading(false)
    }
  }

  async function save() {
    const label = sourceLanguageLabel(language)
    if (!(await confirm({
      title: `Save ${label} official source?`,
      message: `This replaces the ${label} official source for this topic for all users.`,
      confirmLabel: 'Save',
    }))) return
    setSaving(true)
    const res = await fetch('/api/admin/content', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'setTopicSource', topicId, language, source, fileName }),
    })
    const json = await res.json().catch(() => ({}))
    if (res.ok) {
      queueRagIngestion(topicId)
    }
    setSaving(false)
    if (!res.ok) { toast.error(json.error ?? 'Failed to save'); return }
    toast.success(`${label} official source saved`)
    onClose()
    router.refresh()
  }

  return (
    <div className="mt-2 rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-[#30363D] dark:bg-[#0D1117]">
      {loading ? (
        <div className="h-24 bg-gray-100 dark:bg-[#1C2128] rounded animate-pulse" />
      ) : (
        <>
          <input ref={fileRef} type="file" accept=".md,.markdown,text/markdown" onChange={handleFile} className="hidden" />
          <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex w-full bg-gray-100 dark:bg-[#1C2128] rounded-lg p-0.5 sm:w-auto" aria-label="Official source language">
              {SOURCE_LANGUAGES.map(item => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => selectLanguage(item.key)}
                  className={cn(
                    'flex-1 flex items-center justify-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-brand-400/40',
                    language === item.key
                      ? 'bg-white text-gray-900 shadow-sm dark:bg-[#161B22] dark:text-gray-100'
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-600 dark:hover:text-gray-300',
                  )}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="inline-flex min-h-9 w-full items-center justify-center gap-1.5 rounded-lg border border-brand-200 px-3 py-1.5 text-xs font-medium text-brand-600 transition-colors hover:bg-brand-50 disabled:opacity-50 dark:border-brand-800 dark:hover:bg-brand-900/20 sm:w-auto"
            >
              {uploading ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
              {uploading ? 'Reading...' : 'Upload Markdown'}
            </button>
          </div>
          <textarea
            value={source}
            onChange={e => { setSource(e.target.value); setFileName(null) }}
            rows={10}
            placeholder={`${sourceLanguageLabel(language)} official source in Markdown...`}
            className="w-full resize-y rounded-lg border border-gray-200 bg-white p-3 font-mono text-xs text-gray-700 transition-colors focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-400/30 dark:border-[#30363D] dark:bg-[#161B22] dark:text-gray-200"
          />
          <div className="flex flex-wrap items-center justify-between gap-2 mt-2">
            <span className="text-[11px] text-gray-400">{fileName ? `Loaded: ${fileName}` : 'Only .md and .markdown files are accepted'}</span>
            <div className="flex justify-end gap-2">
              <button onClick={onClose} className="min-h-9 rounded-md px-3 py-1.5 text-xs text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-[#1C2128]">Cancel</button>
              <button
                onClick={save}
                disabled={saving || uploading}
                className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-brand-800 disabled:opacity-50"
              >
                {saving && <Loader2 size={12} className="animate-spin" />} Save source
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
