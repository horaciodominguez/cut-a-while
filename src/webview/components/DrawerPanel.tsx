import { useEffect, useRef, type ReactNode } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'

interface DrawerPanelProps {
  title: string
  open: boolean
  onClose: () => void
  children: ReactNode
}

const FOCUSABLE =
  'a[href],button:not([disabled]),textarea,input,select,[tabindex]:not([tabindex="-1"])'

export function DrawerPanel({ title, open, onClose, children }: DrawerPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const previouslyFocused = useRef<HTMLElement | null>(null)
  const reduceMotion = useReducedMotion()

  useEffect(() => {
    if (!open) return

    previouslyFocused.current = document.activeElement as HTMLElement | null
    const panel = panelRef.current
    const focusables = () =>
      panel ? (Array.from(panel.querySelectorAll(FOCUSABLE)) as HTMLElement[]) : []

    const first = focusables()[0]
    first?.focus()

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
        return
      }
      if (e.key !== 'Tab' || !panel) return
      const nodes = focusables()
      if (nodes.length === 0) return
      const firstNode = nodes[0]!
      const lastNode = nodes[nodes.length - 1]!
      if (e.shiftKey && document.activeElement === firstNode) {
        e.preventDefault()
        lastNode.focus()
      } else if (!e.shiftKey && document.activeElement === lastNode) {
        e.preventDefault()
        firstNode.focus()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      previouslyFocused.current?.focus?.()
    }
  }, [open, onClose])

  const slideTransition = reduceMotion
    ? { duration: 0 }
    : { type: 'spring' as const, damping: 32, stiffness: 380 }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.18 }}
            className="drawer-overlay fixed inset-0 z-40"
            onClick={onClose}
            aria-hidden="true"
          />
          <motion.div
            ref={panelRef}
            initial={reduceMotion ? false : { x: '100%' }}
            animate={{ x: 0 }}
            exit={reduceMotion ? { opacity: 0 } : { x: '100%' }}
            transition={slideTransition}
            className="drawer-panel fixed inset-y-0 right-0 z-50 flex w-[min(280px,100%)] flex-col overflow-hidden"
            role="dialog"
            aria-modal="true"
            aria-label={title}
          >
            <div className="drawer-body min-h-0 flex-1 p-5">
              <div className="mb-6 flex items-center justify-between gap-2">
                <h2 className="drawer-title" id="drawer-title">
                  {title}
                </h2>
                <button type="button" onClick={onClose} className="icon-btn shrink-0" aria-label={`Close ${title}`}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
              <div className="drawer-content min-w-0">{children}</div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
