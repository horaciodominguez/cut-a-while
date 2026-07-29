import type { ReactNode } from 'react'

export function GlassCard({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`relative overflow-hidden rounded-2xl border border-white/10 bg-white/10 shadow-2xl shadow-black/20 ${className}`}>
      <div className="relative z-0">{children}</div>
    </div>
  )
}
