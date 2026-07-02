'use client'

import { useEffect, useRef, useState } from 'react'

// Minimal typings for the Web Speech API (not in lib.dom for all TS targets).
interface SpeechRecognitionAlternative { transcript: string }
interface SpeechRecognitionResult { 0: SpeechRecognitionAlternative; isFinal: boolean }
interface SpeechRecognitionEvent { resultIndex: number; results: { length: number; [i: number]: SpeechRecognitionResult } }
interface SpeechRecognitionLike {
  continuous: boolean
  interimResults: boolean
  lang: string
  start: () => void
  stop: () => void
  onresult: ((e: SpeechRecognitionEvent) => void) | null
  onerror: (() => void) | null
  onend: (() => void) | null
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike

/**
 * Thin wrapper over the browser SpeechRecognition API. Chrome/Edge only — `supported` is false
 * elsewhere so callers can fall back to typing. Appends finalized speech to the caller via onFinal.
 */
export function useSpeechRecognition(onFinal: (text: string) => void) {
  const [supported, setSupported] = useState(false)
  const [listening, setListening] = useState(false)
  const recRef = useRef<SpeechRecognitionLike | null>(null)
  const onFinalRef = useRef(onFinal)

  useEffect(() => { onFinalRef.current = onFinal })

  useEffect(() => {
    if (typeof window === 'undefined') return
    const Ctor = (window as unknown as { SpeechRecognition?: SpeechRecognitionCtor; webkitSpeechRecognition?: SpeechRecognitionCtor })
      .SpeechRecognition ?? (window as unknown as { webkitSpeechRecognition?: SpeechRecognitionCtor }).webkitSpeechRecognition
    if (!Ctor) return
    // Client-only feature detection on mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSupported(true)
    const rec = new Ctor()
    rec.continuous = true
    rec.interimResults = false
    rec.lang = 'en-US'
    rec.onresult = (e) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i]
        if (r.isFinal) onFinalRef.current(r[0].transcript)
      }
    }
    rec.onerror = () => setListening(false)
    rec.onend = () => setListening(false)
    recRef.current = rec
    return () => { try { rec.stop() } catch { /* noop */ } }
  }, [])

  function toggle() {
    const rec = recRef.current
    if (!rec) return
    if (listening) { rec.stop(); setListening(false) }
    else { try { rec.start(); setListening(true) } catch { /* already started */ } }
  }

  return { supported, listening, toggle }
}
