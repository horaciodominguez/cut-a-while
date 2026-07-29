import { useCallback, useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { postMessage } from '../vscodeApi.ts'
import { IconSettings } from './Icons.tsx'

interface ExtensionSettings {
  workDuration: number
  breakDuration: number
  longBreakDuration: number
  longBreakInterval: number
  autoStart: boolean
  soundEnabled: boolean
  accent: string
}

const ACCENTS = [
  { id: 'blue', label: 'Blue' },
  { id: 'purple', label: 'Purple' },
  { id: 'green', label: 'Green' },
  { id: 'pink', label: 'Pink' },
  { id: 'orange', label: 'Orange' },
  { id: 'teal', label: 'Teal' },
]

export function SettingsPanel() {
  const [open, setOpen] = useState(false)
  const [settings, setSettings] = useState<ExtensionSettings>({
    workDuration: 1,
    breakDuration: 0.25,
    longBreakDuration: 1,
    longBreakInterval: 4,
    autoStart: true,
    soundEnabled: true,
    accent: 'blue',
  })

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const msg = event.data
      if (msg.command === 'settingsUpdate') {
        setSettings(msg.settings)
      }
    }
    window.addEventListener('message', handler)
    postMessage({ command: 'getSettings' })
    return () => window.removeEventListener('message', handler)
  }, [])

  const updateSetting = useCallback((key: string, value: unknown) => {
    setSettings((prev) => ({ ...prev, [key]: value }))
    postMessage({ command: 'updateSetting', key, value })
  }, [])

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed top-4 right-4 z-30 p-2 rounded-full bg-white/8 border border-white/10 text-white/50 hover:text-white/80 hover:bg-white/15 transition-all duration-200 cursor-pointer"
        aria-label="Open settings"
      >
        <IconSettings />
      </button>

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
              onClick={() => setOpen(false)}
            />

            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="fixed top-0 right-0 z-50 h-full w-72 max-w-[85vw] bg-[#1a1a2e]/95 backdrop-blur-2xl border-l border-white/10 shadow-2xl overflow-y-auto"
            >
              <div className="p-5">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-sm font-semibold text-white/80 uppercase tracking-widest">Settings</h2>
                  <button
                    onClick={() => setOpen(false)}
                    className="p-1 rounded-md text-white/30 hover:text-white/70 hover:bg-white/10 transition-all cursor-pointer"
                    aria-label="Close settings"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </button>
                </div>

                <Section title="Duration">
                  <Slider label="Work (min)" value={settings.workDuration} min={1} max={120} step={1} onChange={(v) => updateSetting('workDuration', v)} />
                  <Slider label="Break (min)" value={settings.breakDuration} min={0.25} max={30} step={0.25} onChange={(v) => updateSetting('breakDuration', v)} />
                  <Slider label="Long break (min)" value={settings.longBreakDuration} min={0.25} max={60} step={0.25} onChange={(v) => updateSetting('longBreakDuration', v)} />
                  <Slider label="Interval (sessions)" value={settings.longBreakInterval} min={1} max={10} step={1} onChange={(v) => updateSetting('longBreakInterval', v)} />
                </Section>

                <Section title="Behavior">
                  <Toggle label="Auto-start" value={settings.autoStart} onChange={(v) => updateSetting('autoStart', v)} />
                  <Toggle label="Sound" value={settings.soundEnabled} onChange={(v) => updateSetting('soundEnabled', v)} />
                </Section>

                <Section title="Accent Color">
                  <div className="flex gap-2 flex-wrap">
                    {ACCENTS.map((a) => (
                      <button
                        key={a.id}
                        onClick={() => updateSetting('accent', a.id)}
                        className={`w-7 h-7 rounded-full border-2 transition-all duration-200 cursor-pointer ${
                          settings.accent === a.id ? 'border-white scale-110' : 'border-transparent'
                        }`}
                        style={{ backgroundColor: accentColor(a.id) }}
                        aria-label={a.label}
                      />
                    ))}
                  </div>
                </Section>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <h3 className="text-[10px] uppercase tracking-[0.15em] text-white/30 mb-3 font-semibold">{title}</h3>
      <div className="space-y-3">{children}</div>
    </div>
  )
}

function Slider({ label, value, min, max, step, onChange }: {
  label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs text-white/60 min-w-24">{label}</span>
      <div className="flex items-center gap-2 flex-1">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className="flex-1 h-1 accent-blue-400 cursor-pointer"
        />
        <span className="text-xs text-white/50 w-10 text-right tabular-nums">{value}</span>
      </div>
    </div>
  )
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-white/60">{label}</span>
      <button
        onClick={() => onChange(!value)}
        className={`relative w-9 h-5 rounded-full transition-colors duration-200 cursor-pointer ${
          value ? 'bg-blue-500' : 'bg-white/20'
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform duration-200 ${
            value ? 'translate-x-4' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  )
}

function accentColor(id: string): string {
  const map: Record<string, string> = {
    blue: '#3b82f6', purple: '#8b5cf6', green: '#10b981',
    pink: '#ec4899', orange: '#f97316', teal: '#14b8a6',
  }
  return map[id] || '#3b82f6'
}
