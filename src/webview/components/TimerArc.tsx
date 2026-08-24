interface TimerArcProps {
  timeLeft: number
  totalTime: number
  stroke: string
  status: string
  pulse?: boolean
}

const R = 100
const CX = 120
const CY = 120
// 270° arc: from 135° to 405° (bottom-left around top to bottom-right)
const START_ANGLE = 135
const SWEEP = 270
const ARC_LENGTH = (SWEEP / 360) * 2 * Math.PI * R

function polar(angleDeg: number) {
  const rad = (angleDeg * Math.PI) / 180
  return {
    x: CX + R * Math.cos(rad),
    y: CY + R * Math.sin(rad),
  }
}

function arcPath() {
  const start = polar(START_ANGLE)
  const end = polar(START_ANGLE + SWEEP)
  return `M ${start.x} ${start.y} A ${R} ${R} 0 1 1 ${end.x} ${end.y}`
}

export function TimerArc({ timeLeft, totalTime, stroke, status, pulse }: TimerArcProps) {
  const progress = totalTime > 0 ? timeLeft / totalTime : 0
  const clamped = Math.min(Math.max(progress, 0), 1)
  const offset = ARC_LENGTH * (1 - clamped)
  const isPaused = status === 'paused'
  const isStopped = status === 'stopped'

  return (
    <svg
      className="block"
      width="240"
      height="200"
      viewBox="0 0 240 200"
      aria-hidden="true"
      style={{
        opacity: pulse ? 0.6 : 1,
        transform: pulse ? 'scale(1.015)' : undefined,
        transition: 'opacity 0.25s ease, transform 0.25s ease',
      }}
    >
      <path
        d={arcPath()}
        fill="none"
        stroke="var(--border-subtle)"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d={arcPath()}
        fill="none"
        stroke={stroke}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeDasharray={ARC_LENGTH}
        strokeDashoffset={offset}
        style={{
          opacity: isStopped ? 0.25 : 1,
          transition: isPaused
            ? 'stroke-dashoffset 0.4s cubic-bezier(0.4, 0, 0.2, 1)'
            : 'stroke-dashoffset 0.9s linear',
        }}
      />
    </svg>
  )
}
