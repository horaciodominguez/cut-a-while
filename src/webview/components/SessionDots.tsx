export function SessionDots({
  completed,
  total = 4,
  accent,
}: {
  completed: number
  total?: number
  accent: string
}) {
  const doneInCycle = completed % total === 0 && completed > 0 ? total : completed % total

  return (
    <div className="flex items-center gap-2.5">
      <div className="flex gap-[5px]">
        {Array.from({ length: total }, (_, i) => (
          <span
            key={i}
            className="block rounded-full transition-all duration-300"
            style={{
              width: 6,
              height: 6,
              background: i < doneInCycle ? accent : 'var(--border-subtle)',
              opacity: i < doneInCycle ? 1 : 0.5,
            }}
          />
        ))}
      </div>
      <span className="text-[10px] tabular-nums font-medium" style={{ color: 'var(--text-tertiary)' }}>
        {doneInCycle}/{total}
      </span>
    </div>
  )
}
