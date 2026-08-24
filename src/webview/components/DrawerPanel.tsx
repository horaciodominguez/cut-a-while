import type { ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'

interface DrawerPanelProps {
  title: string
  open: boolean
  onClose: () => void
  children: ReactNode
}

export function DrawerPanel({ title, open, onClose, children }: DrawerPanelProps) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-40"
            style={{ background: 'color-mix(in srgb, #000 40%, transparent)' }}
            onClick={onClose}
          />
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
            className="fixed top-0 right-0 z-50 h-full w-72 max-w-[85vw] overflow-y-auto border-l"
            style={{
              background: 'var(--surface)',
              borderColor: 'var(--surface-border)',
            }}
            role="dialog"
            aria-label={title}
          >
            <div className="p-4">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
                  {title}
                </h2>
                <button
                  onClick={onClose}
                  className="icon-btn"
                  aria-label={`Close ${title}`}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
