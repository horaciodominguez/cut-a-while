import type { ReactNode } from 'react'

export function Surface({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`relative overflow-hidden rounded-[6px] border ${className}`}
      style={{
        background: 'var(--surface)',
        borderColor: 'var(--surface-border)',
      }}
    >
      {children}
    </div>
  )
}
