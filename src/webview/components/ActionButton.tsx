import type { ReactNode } from 'react'

interface ActionButtonProps {
  onClick: () => void
  label: string
  icon?: ReactNode
  primary?: boolean
  secondary?: boolean
}

export function ActionButton({ onClick, label, icon, primary, secondary }: ActionButtonProps) {
  if (primary) {
    return (
      <button
        onClick={onClick}
        className="inline-flex items-center px-4 py-2 rounded text-sm font-medium cursor-pointer select-none transition-colors duration-150"
        style={{
          background: 'var(--btn-bg)',
          color: 'var(--btn-fg)',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'var(--btn-hover)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'var(--btn-bg)'
        }}
      >
        {icon && <span className="mr-1.5 inline-flex">{icon}</span>}
        {label}
      </button>
    )
  }

  return (
    <button
      onClick={onClick}
      className="inline-flex items-center px-4 py-2 rounded text-sm font-medium cursor-pointer select-none transition-colors duration-150 border"
      style={{
        background: secondary ? 'transparent' : undefined,
        color: 'var(--text)',
        borderColor: 'var(--surface-border)',
      }}
    >
      {icon && <span className="mr-1.5 inline-flex opacity-70">{icon}</span>}
      {label}
    </button>
  )
}
