import { useCallback } from 'react'
import confetti from 'canvas-confetti'

const WORK_COLORS = ['#3b82f6', '#06b6d4', '#6366f1', '#8b5cf6', '#ec4899']
const BREAK_COLORS = ['#10b981', '#34d399', '#059669', '#f59e0b', '#f97316']

export function useConfetti() {
  const fire = useCallback((isLongBreak: boolean) => {
    if (typeof document === 'undefined') return

    const colors = isLongBreak ? BREAK_COLORS : WORK_COLORS
    const count = isLongBreak ? 120 : 80

    confetti({
      particleCount: count,
      spread: 90,
      origin: { x: 0.5, y: 0.4 },
      colors,
      shapes: ['circle', 'square'],
      ticks: 200,
      gravity: 0.6,
      scalar: 1.2,
      startVelocity: 35,
    })

    if (isLongBreak) {
      setTimeout(() => {
        confetti({
          particleCount: 60,
          spread: 120,
          origin: { x: 0.5, y: 0.5 },
          colors: BREAK_COLORS,
          shapes: ['circle'],
          ticks: 150,
          gravity: 0.4,
          scalar: 1.5,
          startVelocity: 25,
        })
      }, 400)
    }
  }, [])

  return fire
}
