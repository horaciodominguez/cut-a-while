import { useEffect, useState } from 'react'

interface TimerRingProps {
  timeLeft: number
  totalTime: number
  isBreak: boolean
  status: string
}

const WORK_COLORS = ['#3b82f6', '#06b6d4', '#6366f1']
const BREAK_COLORS = ['#10b981', '#34d399', '#059669']
const SVG_CIRCUMFERENCE = 2 * Math.PI * 120

export function TimerRing({ timeLeft, totalTime, isBreak, status }: TimerRingProps) {
  const progress = totalTime > 0 ? timeLeft / totalTime : 0
  const offset = SVG_CIRCUMFERENCE * (1 - Math.min(Math.max(progress, 0), 1))
  const [animatedOffset, setAnimatedOffset] = useState(offset)

  useEffect(() => {
    setAnimatedOffset(offset)
  }, [offset])

  const colors = isBreak ? BREAK_COLORS : WORK_COLORS
  const isPaused = status === 'paused'
  const isStopped = status === 'stopped'

  return (
    <svg className="w-full h-full -rotate-90 drop-shadow-[0_0_12px_rgba(59,130,246,0.3)]" viewBox="0 0 260 260">
      <defs>
        <linearGradient id="ringGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={colors[0]} />
          <stop offset="50%" stopColor={colors[1]} />
          <stop offset="100%" stopColor={colors[2]} />
        </linearGradient>
        <filter id="ringGlow">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <circle
        cx="130" cy="130" r="120"
        fill="none"
        stroke="currentColor"
        strokeWidth="6"
        className="text-white/10"
      />

      <circle
        cx="130" cy="130" r="120"
        fill="none"
        stroke="url(#ringGradient)"
        strokeWidth="8"
        strokeLinecap="round"
        strokeDasharray={SVG_CIRCUMFERENCE}
        strokeDashoffset={animatedOffset}
        filter={isPaused ? undefined : 'url(#ringGlow)'}
        className="transition-all duration-700 ease-linear"
        style={{
          opacity: isStopped ? 0.3 : 1,
          transitionTimingFunction: isPaused ? 'cubic-bezier(0.4, 0, 0.2, 1)' : 'linear',
        }}
      />

      {isPaused && (
        <circle
          cx="130" cy="130" r="112"
          fill="none"
          stroke="currentColor"
          strokeWidth="1"
          strokeDasharray="4 8"
          className="text-white/20"
        />
      )}
    </svg>
  )
}
