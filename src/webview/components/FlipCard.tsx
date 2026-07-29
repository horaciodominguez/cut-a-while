import { useEffect, useState } from 'react'

export function FlipCard({ digit, label }: { digit: string; label?: string }) {
  const [prevDigit, setPrevDigit] = useState(digit)
  const [flipping, setFlipping] = useState(false)

  useEffect(() => {
    if (digit !== prevDigit) {
      setFlipping(true)
      const timer = setTimeout(() => {
        setPrevDigit(digit)
        setFlipping(false)
      }, 300)
      return () => clearTimeout(timer)
    }
  }, [digit, prevDigit])

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative w-14 h-20 sm:w-16 sm:h-24">
        <div
          className={`absolute inset-0 flex items-center justify-center rounded-xl bg-white/10 border border-white/15 text-white font-jetbrains text-3xl sm:text-4xl font-bold tabular-nums select-none
            ${flipping ? 'animate-flip-down' : ''}`}
          style={{
            backfaceVisibility: 'hidden',
            transformStyle: 'preserve-3d',
            perspective: '200px',
          }}
        >
          {prevDigit}
        </div>
        {flipping && (
          <div
            className="absolute inset-0 flex items-center justify-center rounded-xl bg-blue-500/20 border border-blue-400/30 text-white font-jetbrains text-3xl sm:text-4xl font-bold tabular-nums select-none animate-flip-up"
            style={{
              backfaceVisibility: 'hidden',
              transformStyle: 'preserve-3d',
              perspective: '200px',
            }}
          >
            {digit}
          </div>
        )}
      </div>
      {label && <span className="text-[10px] uppercase tracking-widest text-white/40">{label}</span>}
    </div>
  )
}
