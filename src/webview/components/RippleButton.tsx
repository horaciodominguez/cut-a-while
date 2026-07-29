import { useRef, useState, type MouseEvent, type ReactNode } from 'react'

interface RippleButtonProps {
  onClick: () => void
  label: string
  icon?: ReactNode
  primary?: boolean
  secondary?: boolean
}

export function RippleButton({ onClick, label, icon, primary, secondary }: RippleButtonProps) {
  const [ripples, setRipples] = useState<Array<{ x: number; y: number; id: number }>>([])
  const counter = useRef(0)

  function handleClick(e: MouseEvent<HTMLButtonElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const id = ++counter.current
    setRipples((prev) => [...prev, { x, y, id }])
    setTimeout(() => setRipples((prev) => prev.filter((r) => r.id !== id)), 600)
    onClick()
  }

  return (
    <button
      onClick={handleClick}
      className={`relative overflow-hidden px-5 py-2.5 rounded-full text-sm font-medium transition-all duration-150 active:scale-95 cursor-pointer select-none
        ${primary
          ? 'bg-blue-500/80 text-white hover:bg-blue-500/90 shadow-lg shadow-blue-500/25'
          : secondary
            ? 'bg-white/8 text-white/70 hover:bg-white/15 border border-white/10'
            : ''
        }`}
    >
      {icon && <span className="mr-1.5 inline-flex">{icon}</span>}
      {label}
      {ripples.map((r) => (
        <span
          key={r.id}
          className="absolute pointer-events-none rounded-full bg-white/20 animate-ripple"
          style={{ left: r.x - 10, top: r.y - 10, width: 20, height: 20 }}
        />
      ))}
    </button>
  )
}
