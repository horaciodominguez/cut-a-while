interface StreakIndicatorProps {
  streak: number
}

export function StreakIndicator({ streak }: StreakIndicatorProps) {
  if (streak <= 0) return null

  return (
    <div
      className="flex items-center gap-1.5 text-[11px]"
      style={{ color: 'var(--text-tertiary)' }}
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 3c1.5 3 2 5.5 1 8 2-1 4 0 5 2 1 2 0 5-2 7-1.5 1.5-3.5 2.5-6 2.5s-4.5-1-6-2.5c-2-2-3-5-2-7 1-2 3-3 5-2-1-2.5-.5-5 1-8z" />
      </svg>
      <span className="tabular-nums font-medium" style={{ color: 'var(--text-secondary)' }}>
        {streak}
      </span>
      <span>day streak</span>
    </div>
  )
}
