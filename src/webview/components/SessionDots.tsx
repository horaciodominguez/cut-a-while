import { filledSessionDots } from '../../core/utils/time.ts'

export function SessionDots({
  completed,
  total = 4,
  cycleType,
  accent,
}: {
  completed: number
  total?: number
  cycleType: 'work' | 'break'
  accent: string
}) {
  const doneInCycle = filledSessionDots(completed, total, cycleType)
  const label = `${doneInCycle} of ${total} sessions in this cycle`

  return (
    <div className="flex items-center gap-2.5" role="img" aria-label={label}>
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
    </div>
  )
}
