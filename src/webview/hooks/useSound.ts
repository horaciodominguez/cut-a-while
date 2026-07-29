import { useCallback, useRef } from 'react'

const beep = (frequency: number, duration: number, type: OscillatorType = 'sine') => {
  try {
    const ctx = new AudioContext()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.frequency.value = frequency
    osc.type = type
    gain.gain.setValueAtTime(0.15, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration)
    osc.start()
    osc.stop(ctx.currentTime + duration)
    ctx.close()
  } catch {
    // Web Audio not available
  }
}

export function useSound(enabled: boolean) {
  const enabledRef = useRef(enabled)
  enabledRef.current = enabled

  const playWorkComplete = useCallback(() => {
    if (!enabledRef.current) return
    beep(880, 0.3, 'sine')
    setTimeout(() => beep(1100, 0.4, 'sine'), 150)
  }, [])

  const playBreakComplete = useCallback(() => {
    if (!enabledRef.current) return
    beep(660, 0.25, 'triangle')
  }, [])

  return { playWorkComplete, playBreakComplete }
}
