import { motion } from 'framer-motion'

export function SessionDots({ completed, total = 4 }: { completed: number; total?: number }) {
  return (
    <div className="flex gap-1.5 items-center">
      {Array.from({ length: total }, (_, i) => {
        const filled = i < completed % total
        return (
          <motion.span
            key={i}
            layout
            className={`w-2.5 h-2.5 rounded-full transition-colors duration-300 ${
              filled ? 'bg-blue-400 shadow-[0_0_6px_rgba(96,165,250,0.5)]' : 'bg-white/15'
            }`}
            animate={{
              scale: filled ? 1.15 : 1,
              opacity: filled ? 1 : 0.4,
            }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
          />
        )
      })}
      <span className="text-[10px] text-white/30 ml-1 uppercase tracking-wider">
        {completed % total}/{total}
      </span>
    </div>
  )
}
