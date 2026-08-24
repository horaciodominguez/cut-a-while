interface TimerRingProps {
  timeLeft: number
  totalTime: number
  isBreak: boolean
  status: string
  accent: string
  pulse?: boolean
}

const SVG_CIRCUMFERENCE = 2 * Math.PI * 120

export function TimerRing({ timeLeft, totalTime, isBreak, status, accent, pulse }: TimerRingProps) {
  const progress = totalTime > 0 ? timeLeft / totalTime : 0
  const offset = SVG_CIRCUMFERENCE * (1 - Math.min(Math.max(progress, 0), 1))
  const isPaused = status === 'paused'
  const isStopped = status === 'stopped'
  const stroke = isBreak ? '#10b981' : accent

  return (
    <svg
      className={`w-full h-full -rotate-90 transition-opacity duration-300 ${pulse ? 'opacity-40' : ''}`}
      viewBox="0 0 260 260"
      style={pulse ? { transform: 'rotate(-90deg) scale(1.02)' } : undefined}
    >
      <circle
        cx="130"
        cy="130"
        r="120"
        fill="none"
        stroke="var(--ring-track)"
        strokeWidth="4"
      />
      <circle
        cx="130"
        cy="130"
        r="120"
        fill="none"
        stroke={stroke}
        strokeWidth="5"
        strokeLinecap="round"
        strokeDasharray={SVG_CIRCUMFERENCE}
        strokeDashoffset={offset}
        className="transition-[stroke-dashoffset] duration-700 ease-linear"
        style={{
          opacity: isStopped ? 0.35 : 1,
          transitionTimingFunction: isPaused ? 'cubic-bezier(0.4, 0, 0.2, 1)' : 'linear',
        }}
      />
      {isPaused && (
        <circle
          cx="130"
          cy="130"
          r="112"
          fill="none"
          stroke="var(--text-muted)"
          strokeWidth="1"
          strokeDasharray="4 8"
          opacity={0.5}
        />
      )}
    </svg>
  )
}
