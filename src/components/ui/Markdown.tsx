'use client'

import { memo, type ReactNode } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { cn } from '@/lib/utils'
import { MermaidBlock } from './MermaidBlock'

interface MarkdownProps {
  children: string
  className?: string
  compact?: boolean
  /** Treat single newlines as line breaks — useful for raw pasted/plain text. */
  preserveBreaks?: boolean
  /** Prefix applied to generated heading IDs so readers can deep-link within one rendered document. */
  headingIdPrefix?: string
}

function nodeText(node: ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(nodeText).join('')
  return ''
}

function slugifyHeading(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'section'
}

// Memoized: prevents ReactMarkdown from re-rendering (and reconciling away injected
// highlight <mark> nodes) when an unrelated parent state changes.
export const Markdown = memo(function Markdown({ children, className, compact = false, preserveBreaks = false, headingIdPrefix }: MarkdownProps) {
  // Markdown collapses single newlines; for plain pasted text keep them as hard breaks
  // (two trailing spaces) while leaving blank-line paragraph breaks intact.
  const content = preserveBreaks ? children.replace(/(?<!\n)\n(?!\n)/g, '  \n') : children
  const headingCounts = new Map<string, number>()
  const getHeadingId = (heading: ReactNode) => {
    if (!headingIdPrefix) return undefined
    const base = slugifyHeading(nodeText(heading))
    const count = headingCounts.get(base) ?? 0
    headingCounts.set(base, count + 1)
    return `${headingIdPrefix}-${base}${count ? `-${count + 1}` : ''}`
  }

  return (
    <div className={cn(compact && 'text-sm', className)}>
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        h1: ({ children }) => (
          <h1 id={getHeadingId(children)} className="scroll-mt-24 text-xl font-bold text-gray-900 dark:text-gray-100 mt-6 mb-3 first:mt-0 pb-2 border-b border-gray-200 dark:border-[#30363D]">
            {children}
          </h1>
        ),
        h2: ({ children }) => (
          <h2 id={getHeadingId(children)} className="scroll-mt-24 text-lg font-semibold text-gray-800 dark:text-gray-200 mt-5 mb-2 first:mt-0">
            {children}
          </h2>
        ),
        h3: ({ children }) => (
          <h3 id={getHeadingId(children)} className="scroll-mt-24 text-base font-semibold text-[var(--brand-600)] mt-4 mb-1.5 first:mt-0">
            {children}
          </h3>
        ),
        p: ({ children }) => (
          <p className={cn('text-gray-700 dark:text-gray-300 leading-relaxed', compact ? 'mb-2 text-sm' : 'mb-3')}>
            {children}
          </p>
        ),
        ul: ({ children }) => (
          <ul className={cn('space-y-1 mb-3 pl-5 list-disc marker:text-[var(--brand-600)] text-gray-700 dark:text-gray-300', compact ? 'text-sm' : '')}>
            {children}
          </ul>
        ),
        ol: ({ children }) => (
          <ol className={cn('space-y-1 mb-3 pl-5 list-decimal marker:text-[var(--brand-600)] text-gray-700 dark:text-gray-300', compact ? 'text-sm' : '')}>
            {children}
          </ol>
        ),
        li: ({ children }) => (
          <li className="text-gray-700 dark:text-gray-300 leading-relaxed pl-1">
            {children}
          </li>
        ),
        strong: ({ children }) => (
          <strong className="font-semibold text-gray-900 dark:text-gray-100">{children}</strong>
        ),
        em: ({ children }) => (
          <em className="italic text-gray-600 dark:text-gray-400">{children}</em>
        ),
        code: ({ children, className }) => {
          if (className?.includes('language-mermaid')) {
            return <MermaidBlock chart={String(children)} />
          }
          const isBlock = className?.includes('language-')
          if (isBlock) {
            return (
              <code className="block bg-gray-900 text-green-400 text-xs rounded-lg p-3 mb-3 overflow-x-auto font-mono leading-relaxed whitespace-pre">
                {children}
              </code>
            )
          }
          return (
            <code className="bg-[var(--brand-50)] text-[var(--brand-800)] text-xs font-mono px-1.5 py-0.5 rounded">
              {children}
            </code>
          )
        },
        pre: ({ children }) => <>{children}</>,
        blockquote: ({ children }) => (
          <blockquote className="border-l-4 border-[var(--brand-600)] bg-[var(--brand-50)] dark:bg-brand-900/10 pl-4 pr-3 py-2 mb-3 rounded-r-lg text-sm text-gray-700 dark:text-gray-300 italic">
            {children}
          </blockquote>
        ),
        hr: () => <hr className="border-gray-200 dark:border-[#30363D] my-4" />,
        table: ({ children }) => (
          <div className="overflow-x-auto mb-3">
            <table className="w-full text-sm border-collapse">{children}</table>
          </div>
        ),
        thead: ({ children }) => (
          <thead className="bg-[var(--brand-50)] dark:bg-brand-900/20">{children}</thead>
        ),
        th: ({ children }) => (
          <th className="px-3 py-2 text-left font-semibold text-[var(--brand-800)] border border-gray-200 dark:border-[#30363D] text-xs uppercase tracking-wide">
            {children}
          </th>
        ),
        td: ({ children }) => (
          <td className="px-3 py-2 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-[#30363D]">{children}</td>
        ),
        tr: ({ children }) => (
          <tr className="even:bg-gray-50 dark:even:bg-[#1C2128]">{children}</tr>
        ),
        a: ({ children, href }) => (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[var(--brand-600)] underline underline-offset-2 hover:text-[var(--brand-800)]"
          >
            {children}
          </a>
        ),
      }}
    >
      {content}
    </ReactMarkdown>
    </div>
  )
})
