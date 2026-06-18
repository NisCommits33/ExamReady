'use client'

import { useEffect, useRef, useState } from 'react'

let mermaidInitialized = false

export function MermaidBlock({ chart }: { chart: string }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [svg, setSvg] = useState('')
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function render() {
      try {
        const mermaid = (await import('mermaid')).default
        if (!mermaidInitialized) {
          mermaid.initialize({
            startOnLoad: false,
            theme: 'neutral',
            fontFamily: 'inherit',
            securityLevel: 'loose',
            suppressErrorRendering: true,
          })
          mermaidInitialized = true
        }

        const cleaned = chart.trim().replace(/\\n/g, '\n')
        const valid = await mermaid.parse(cleaned).catch(() => false)
        if (!valid) { if (!cancelled) setError(true); return }

        const id = `mermaid-${Math.random().toString(36).slice(2, 9)}`
        const { svg: rendered } = await mermaid.render(id, cleaned)
        if (!cancelled) setSvg(rendered)
      } catch {
        if (!cancelled) setError(true)
      }
    }

    render()
    return () => { cancelled = true }
  }, [chart])

  // Clean up any orphaned mermaid error elements
  useEffect(() => {
    document.querySelectorAll('[id^="dmermaid-"]').forEach(el => el.remove())
  }, [error, svg])

  if (error) return null

  if (!svg) {
    return (
      <div className="flex items-center justify-center py-6 mb-3 bg-gray-50 dark:bg-[#1C2128] rounded-lg">
        <div className="w-4 h-4 border-2 border-gray-200 border-t-brand-600 rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className="mb-3 overflow-x-auto bg-white dark:bg-[#161B22] rounded-lg p-4 border border-gray-200 dark:border-[#30363D] [&_svg]:max-w-full [&_svg]:h-auto"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
}
