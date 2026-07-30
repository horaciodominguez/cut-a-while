import { motion } from 'framer-motion'

const MILESTONES = [7, 14, 30, 60, 100]

interface StreakIndicatorProps {
  streak: number
}

export function StreakIndicator({ streak }: StreakIndicatorProps) {
  if (streak <= 0) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center gap-2 mt-4"
    >
      <div className="flex items-center gap-1.5">
        <span className="text-lg">🔥</span>
        <span className="text-sm font-semibold text-white/70 tabular-nums">{streak}</span>
        <span className="text-xs text-white/40">day{streak !== 1 ? 's' : ''}</span>
      </div>
      <div className="flex gap-2">
        {MILESTONES.map((m) => {
          const reached = streak >= m
          return (
            <span
              key={m}
              className={`text-[10px] px-2 py-0.5 rounded-full font-medium transition-all duration-300 ${
                reached
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                  : 'bg-white/5 text-white/20 border border-white/5'
              }`}
            >
              {m}
              {reached ? ' ⭐' : ''}
            </span>
          )
        })}
      </div>
    </motion.div>
  )
}
