'use client'

import { cn } from '@/lib/utils'

/** Returns true if a string looks like inline SVG markup. */
export function isSvg(value: string): boolean {
  return typeof value === 'string' && value.trim().toLowerCase().startsWith('<svg')
}

/** Strip anything unsafe from AI-generated SVG before rendering. */
function sanitizeSvg(svg: string): string {
  return svg
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/\son\w+="[^"]*"/gi, '')
    .replace(/\son\w+='[^']*'/gi, '')
    .replace(/javascript:/gi, '')
}

interface Props {
  svg: string
  className?: string
}

export function IQFigure({ svg, className }: Props) {
  return (
    <div
      className={cn('iq-figure inline-flex items-center justify-center text-gray-800 dark:text-gray-200 [&_svg]:max-w-full [&_svg]:h-auto', className)}
      dangerouslySetInnerHTML={{ __html: sanitizeSvg(svg) }}
    />
  )
}
