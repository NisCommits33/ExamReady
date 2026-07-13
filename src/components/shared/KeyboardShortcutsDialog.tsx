'use client'

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { shortcutLabel, type ShortcutDefinition } from '@/hooks/useKeyboardShortcuts'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  shortcuts: ShortcutDefinition[]
}

export function KeyboardShortcutsDialog({ open, onOpenChange, shortcuts }: Props) {
  const visibleShortcuts = shortcuts.filter(shortcut => shortcut.enabled !== false)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
          <DialogDescription>Shortcuts work when you are not typing in a field.</DialogDescription>
        </DialogHeader>
        <div className="space-y-1">
          {visibleShortcuts.map(shortcut => (
            <div
              key={shortcut.id}
              className="flex min-h-10 items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-sm"
            >
              <span className="text-gray-700 dark:text-gray-200">{shortcut.label}</span>
              <kbd className="shrink-0 rounded-md border border-gray-200 bg-gray-50 px-2 py-1 font-mono text-[11px] font-medium text-gray-500 dark:border-[#30363D] dark:bg-[#161B22] dark:text-gray-300">
                {shortcutLabel(shortcut.keys)}
              </kbd>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
