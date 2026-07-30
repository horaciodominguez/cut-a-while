import { useCallback, useRef } from 'react'

type SoundTheme = 'bell' | 'digital' | 'nature' | 'zen' | 'soft' | 'classic'

const beep = (frequency: number, duration: number, type: OscillatorType = 'sine', volume = 0.15) => {
  try {
    const ctx = new AudioContext()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.frequency.value = frequency
    osc.type = type
    gain.gain.setValueAtTime(volume, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration)
    osc.start()
    osc.stop(ctx.currentTime + duration)
    ctx.close()
  } catch {
    // Web Audio not available
  }
}

const noir = (freq: number, dur: number, delay: number, type: OscillatorType, vol: number) => {
  setTimeout(() => beep(freq, dur, type, vol), delay)
}

const THEMES: Record<SoundTheme, { work: (() => void); break: (() => void) }> = {
  bell: {
    work: () => { beep(880, 0.3, 'sine'); noir(1100, 0.4, 150, 'sine', 0.15) },
    break: () => beep(660, 0.25, 'triangle'),
  },
  digital: {
    work: () => { beep(1000, 0.1, 'square'); noir(1200, 0.1, 100, 'square', 0.1); noir(1400, 0.15, 200, 'square', 0.1) },
    break: () => beep(800, 0.1, 'square'),
  },
  nature: {
    work: () => { beep(500, 0.4, 'triangle'); noir(700, 0.3, 200, 'triangle', 0.1) },
    break: () => beep(400, 0.35, 'triangle'),
  },
  zen: {
    work: () => { beep(440, 0.8, 'sine', 0.12) },
    break: () => beep(330, 0.6, 'sine', 0.1),
  },
  soft: {
    work: () => { beep(660, 0.2, 'sine'); noir(880, 0.25, 200, 'sine', 0.1) },
    break: () => beep(550, 0.2, 'sine'),
  },
  classic: {
    work: () => { beep(750, 0.15, 'sine'); noir(1000, 0.15, 120, 'sine', 0.15); noir(1250, 0.2, 240, 'sine', 0.15) },
    break: () => beep(620, 0.12, 'sine'),
  },
}

export function useSound(enabled: boolean, theme: SoundTheme = 'bell') {
  const enabledRef = useRef(enabled)
  enabledRef.current = enabled
  const themeRef = useRef(theme)
  themeRef.current = theme

  const playWorkComplete = useCallback(() => {
    if (!enabledRef.current) return
    THEMES[themeRef.current]?.work()
  }, [])

  const playBreakComplete = useCallback(() => {
    if (!enabledRef.current) return
    THEMES[themeRef.current]?.break()
  }, [])

  return { playWorkComplete, playBreakComplete }
}

