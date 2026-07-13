'use client'

import { createContext, useContext, useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { Play, Pause, RotateCcw, SkipForward, X } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { recordStudyEvent } from '@/lib/study-events'

type Phase = 'work' | 'short' | 'long'
interface Durations { work: number; short: number; long: number }

const DEFAULTS: Durations = { work: 25, short: 5, long: 15 }
const CYCLES_BEFORE_LONG = 4
const STORAGE_KEY = 'pomodoro_settings'

const PHASE_LABEL: Record<Phase, string> = { work: 'Focus', short: 'Short break', long: 'Long break' }

/** FAB tint per phase (brand for focus, green/amber for breaks). */
export const PHASE_FAB: Record<Phase, string> = {
  work: 'bg-brand-600 hover:bg-brand-800 text-white',
  short: 'bg-green-600 hover:bg-green-700 text-white',
  long: 'bg-amber-500 hover:bg-amber-600 text-white',
}
const PHASE_ACCENT: Record<Phase, string> = {
  work: 'text-brand-600 dark:text-brand-400',
  short: 'text-green-600 dark:text-green-400',
  long: 'text-amber-600 dark:text-amber-400',
}

function clampMinutes(n: number): number {
  if (!Number.isFinite(n)) return 1
  return Math.min(180, Math.max(1, Math.round(n)))
}
function fmt(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

interface PomodoroValue {
  phase: Phase
  running: boolean
  secondsLeft: number
  durations: Durations
  completedWork: number
  timeText: string
  fabTint: string
  toggle: () => void
  reset: () => void
  skip: () => void
  setDuration: (key: keyof Durations, value: number) => void
}

const PomodoroContext = createContext<PomodoroValue | null>(null)

export function usePomodoro(): PomodoroValue {
  const ctx = useContext(PomodoroContext)
  if (!ctx) throw new Error('usePomodoro must be used inside <PomodoroProvider>')
  return ctx
}

export function PomodoroProvider({ children }: { children: React.ReactNode }) {
  const [durations, setDurations] = useState<Durations>(DEFAULTS)
  const [phase, setPhase] = useState<Phase>('work')
  const [running, setRunning] = useState(false)
  const [secondsLeft, setSecondsLeft] = useState(DEFAULTS.work * 60)
  const [completedWork, setCompletedWork] = useState(0)

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const stateRef = useRef({ phase, completedWork, durations, running })
  useEffect(() => { stateRef.current = { phase, completedWork, durations, running } }, [phase, completedWork, durations, running])

  // Load persisted durations once.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<Durations>
        const next: Durations = {
          work: clampMinutes(parsed.work ?? DEFAULTS.work),
          short: clampMinutes(parsed.short ?? DEFAULTS.short),
          long: clampMinutes(parsed.long ?? DEFAULTS.long),
        }
        // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrate saved durations on mount
        setDurations(next)
        setSecondsLeft(next.work * 60)
      }
    } catch {}
  }, [])

  useEffect(() => () => { if (intervalRef.current) clearInterval(intervalRef.current) }, [])

  function persist(next: Durations) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)) } catch {}
  }
  function durationFor(p: Phase, d: Durations): number {
    return (p === 'work' ? d.work : p === 'short' ? d.short : d.long) * 60
  }

  function playBeep() {
    try {
      let ctx = audioCtxRef.current
      if (!ctx) {
        ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
        audioCtxRef.current = ctx
      }
      if (ctx.state === 'suspended') ctx.resume()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain); gain.connect(ctx.destination)
      osc.type = 'sine'; osc.frequency.value = 880
      gain.gain.setValueAtTime(0.001, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6)
      osc.start(); osc.stop(ctx.currentTime + 0.62)
    } catch {}
  }
  function notify(title: string, body: string) {
    try {
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') new Notification(title, { body })
    } catch {}
  }
  function nextPhase(current: Phase, completed: number): { phase: Phase; completedWork: number } {
    if (current === 'work') {
      const newCompleted = completed + 1
      return { phase: newCompleted % CYCLES_BEFORE_LONG === 0 ? 'long' : 'short', completedWork: newCompleted }
    }
    return { phase: 'work', completedWork: completed }
  }

  const handlePhaseEnd = useCallback(() => {
    const { phase: cur, completedWork: done, durations: d } = stateRef.current
    playBeep()
    const { phase: np, completedWork: nc } = nextPhase(cur, done)
    if (cur === 'work') {
      void recordStudyEvent({
        eventType: 'pomodoro_focus',
        source: 'pomodoro',
        durationS: d.work * 60,
        metadata: { completedWork: done + 1 },
      })
    }
    const msg = cur === 'work' ? `Focus done — time for a ${np === 'long' ? 'long' : 'short'} break` : 'Break over — back to focus'
    toast.success(msg)
    notify(PHASE_LABEL[np], msg)
    setCompletedWork(nc); setPhase(np); setSecondsLeft(durationFor(np, d)); setRunning(false)
  }, [])

  useEffect(() => {
    if (!running) {
      if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null }
      return
    }
    intervalRef.current = setInterval(() => {
      setSecondsLeft(prev => { if (prev <= 1) { handlePhaseEnd(); return 0 } return prev - 1 })
    }, 1000)
    return () => { if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null } }
  }, [running, handlePhaseEnd])

  const start = useCallback(async () => {
    try {
      if (!audioCtxRef.current) audioCtxRef.current = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
      if (audioCtxRef.current.state === 'suspended') await audioCtxRef.current.resume()
    } catch {}
    try {
      if (typeof Notification !== 'undefined' && Notification.permission === 'default') await Notification.requestPermission()
    } catch {}
    setRunning(true)
  }, [])

  const toggle = useCallback(() => { setRunning(r => { if (r) return false; void start(); return r }) }, [start])
  const reset = useCallback(() => { setRunning(false); setSecondsLeft(durationFor(stateRef.current.phase, stateRef.current.durations)) }, [])
  const skip = useCallback(() => {
    const { phase: cur, completedWork: done, durations: d } = stateRef.current
    setRunning(false)
    const { phase: np, completedWork: nc } = nextPhase(cur, done)
    setCompletedWork(nc); setPhase(np); setSecondsLeft(durationFor(np, d))
  }, [])
  const setDuration = useCallback((key: keyof Durations, value: number) => {
    const v = clampMinutes(value)
    const next = { ...stateRef.current.durations, [key]: v }
    setDurations(next)
    persist(next)
    // If idle on the edited phase, reflect the new length immediately.
    if (!stateRef.current.running && stateRef.current.phase === key) setSecondsLeft(v * 60)
  }, [])

  const value = useMemo<PomodoroValue>(() => ({
    phase, running, secondsLeft, durations, completedWork,
    timeText: fmt(secondsLeft), fabTint: PHASE_FAB[phase],
    toggle, reset, skip, setDuration,
  }), [phase, running, secondsLeft, durations, completedWork, toggle, reset, skip, setDuration])

  return <PomodoroContext.Provider value={value}>{children}</PomodoroContext.Provider>
}

/** The timer popover (start/pause/reset/skip + duration settings). Controlled open state. */
export function PomodoroPanel({ open, onClose, className }: { open: boolean; onClose: () => void; className?: string }) {
  const { phase, running, secondsLeft, durations, completedWork, toggle, reset, skip, setDuration } = usePomodoro()
  if (!open) return null
  const cycleInSet = (completedWork % CYCLES_BEFORE_LONG) + (phase === 'work' ? 1 : 0)

  return (
    <div
      className={cn('w-64 rounded-2xl border border-gray-200 dark:border-[#30363D] bg-white dark:bg-[#0D1117] shadow-xl p-4', className)}
      role="dialog"
      aria-label="Pomodoro timer"
    >
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className={cn('text-sm font-semibold', PHASE_ACCENT[phase])}>{PHASE_LABEL[phase]}</p>
          <p className="text-[11px] text-gray-400">{phase === 'long' ? 'Long break' : `Cycle ${cycleInSet} of ${CYCLES_BEFORE_LONG}`}</p>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" aria-label="Close"><X size={16} /></button>
      </div>

      <div className="text-center mb-3">
        <span className="text-5xl font-bold tabular-nums text-gray-900 dark:text-gray-100">{fmt(secondsLeft)}</span>
      </div>

      <div className="flex items-center justify-center gap-2 mb-4">
        <button onClick={toggle} className={cn('flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors active:scale-95', PHASE_FAB[phase])}>
          {running ? <Pause size={15} /> : <Play size={15} />}{running ? 'Pause' : 'Start'}
        </button>
        <button onClick={reset} className="p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-[#1C2128] transition-colors" title="Reset" aria-label="Reset"><RotateCcw size={16} /></button>
        <button onClick={skip} className="p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-[#1C2128] transition-colors" title="Skip" aria-label="Skip"><SkipForward size={16} /></button>
      </div>

      <div className="border-t border-gray-100 dark:border-[#30363D] pt-3 grid grid-cols-3 gap-2">
        {(['work', 'short', 'long'] as const).map(key => (
          <label key={key} className="flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-wide text-gray-400">{key === 'work' ? 'Focus' : key === 'short' ? 'Short' : 'Long'}</span>
            <input
              type="number" min={1} max={180} value={durations[key]}
              onChange={e => setDuration(key, Number(e.target.value))}
              className="h-8 w-full rounded-lg border border-gray-200 dark:border-[#30363D] bg-transparent px-2 text-sm text-gray-900 dark:text-gray-100 tabular-nums outline-none focus:border-brand-600"
            />
          </label>
        ))}
      </div>
    </div>
  )
}
