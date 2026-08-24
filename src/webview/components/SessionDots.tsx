export function SessionDots({
  completed,
  total = 4,
  accent,
}: {
  completed: number
  total?: number
  accent: string
}) {
  return (
    <div className="flex gap-1.5 items-center">
      {Array.from({ length: total }, (_, i) => {
        const filled = i < completed % total
        return (
          <span
            key={i}
            className="w-2 h-2 rounded-full transition-colors duration-200"
            style={{
              background: filled ? accent : 'var(--ring-track)',
              opacity: filled ? 1 : 0.5,
            }}
          />
        )
      })}
      <span className="text-[10px] ml-1 tabular-nums" style={{ color: 'var(--text-muted)' }}>
        {completed % total}/{total}
      </span>
    </div>
  )
}
