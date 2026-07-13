'use client'

import { useEffect, useMemo } from 'react'

export interface ShortcutDefinition {
  id: string
  label: string
  keys: string
  handler: () => void
  enabled?: boolean
  scope?: string
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  const editable = target.closest('input, textarea, select, [contenteditable="true"]')
  return Boolean(editable)
}

function isModShortcut(event: KeyboardEvent): boolean {
  return event.ctrlKey || event.metaKey
}

function shortcutMatches(event: KeyboardEvent, keys: string): boolean {
  const parts = keys.toLowerCase().split('+').map(part => part.trim())
  const wantsMod = parts.includes('mod')
  const wantsShift = parts.includes('shift')
  const wantsAlt = parts.includes('alt')
  const wantsKey = parts.find(part => !['mod', 'shift', 'alt'].includes(part))

  if (wantsMod !== isModShortcut(event)) return false
  if (wantsShift !== event.shiftKey) return false
  if (wantsAlt !== event.altKey) return false
  if (!wantsKey) return false

  const key = event.key.toLowerCase()
  if (wantsKey === 'arrowright') return key === 'arrowright'
  if (wantsKey === 'arrowleft') return key === 'arrowleft'
  if (wantsKey === 'enter') return key === 'enter'
  if (wantsKey === '/') return key === '/'
  return key === wantsKey
}

export function shortcutLabel(keys: string): string {
  if (typeof navigator === 'undefined') return keys.replace(/mod/gi, 'Ctrl')
  const mod = /Mac|iPhone|iPad|iPod/.test(navigator.platform) ? '⌘' : 'Ctrl'
  return keys
    .split('+')
    .map(part => {
      const value = part.trim()
      if (value.toLowerCase() === 'mod') return mod
      if (value.toLowerCase() === 'shift') return 'Shift'
      if (value.toLowerCase() === 'arrowright') return '→'
      if (value.toLowerCase() === 'arrowleft') return '←'
      if (value.toLowerCase() === 'enter') return 'Enter'
      return value.toUpperCase()
    })
    .join(' + ')
}

export function useKeyboardShortcuts(definitions: ShortcutDefinition[]) {
  const enabledDefinitions = useMemo(
    () => definitions.filter(definition => definition.enabled !== false),
    [definitions],
  )

  useEffect(() => {
    if (enabledDefinitions.length === 0) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) return
      const match = enabledDefinitions.find(definition => shortcutMatches(event, definition.keys))
      if (!match) return
      event.preventDefault()
      match.handler()
    }

    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [enabledDefinitions])
}
