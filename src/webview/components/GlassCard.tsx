import type { ReactNode } from 'react'

export function GlassCard({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 shadow-2xl shadow-black/20 ${className}`}>
      <div className="absolute inset-0 backdrop-blur-2xl -z-0" />
      <div className="absolute inset-0 bg-gradient-to-br from-white/[0.03] to-transparent -z-0" />
      <div className="relative z-0">{children}</div>
    </div>
  )
}
