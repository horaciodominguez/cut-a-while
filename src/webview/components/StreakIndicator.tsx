interface StreakIndicatorProps {
  streak: number
}

const MILESTONES = [7, 14, 30, 60, 100]

export function StreakIndicator({ streak }: StreakIndicatorProps) {
  if (streak <= 0) return null

  return (
    <div className="flex flex-col items-center gap-2 mt-2">
      <div className="flex items-center gap-1.5" style={{ color: 'var(--text-muted)' }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 3c1.5 3 2 5.5 1 8 2-1 4 0 5 2 1 2 0 5-2 7-1.5 1.5-3.5 2.5-6 2.5s-4.5-1-6-2.5c-2-2-3-5-2-7 1-2 3-3 5-2-1-2.5-.5-5 1-8z" />
        </svg>
        <span className="text-sm font-medium tabular-nums" style={{ color: 'var(--text)' }}>
          {streak}
        </span>
        <span className="text-xs">day{streak !== 1 ? 's' : ''}</span>
      </div>
      <div className="flex gap-1.5 items-center">
        {MILESTONES.map((m) => {
          const reached = streak >= m
          return (
            <span
              key={m}
              title={`${m} days`}
              className="text-[9px] tabular-nums px-1.5 py-0.5 rounded"
              style={{
                color: reached ? 'var(--accent)' : 'var(--text-muted)',
                opacity: reached ? 1 : 0.4,
                border: `1px solid ${reached ? 'var(--accent)' : 'var(--surface-border)'}`,
              }}
            >
              {m}
            </span>
          )
        })}
      </div>
    </div>
  )
}
