import { useCallback, useEffect, useState } from 'react'
import { postMessage } from '../vscodeApi.ts'
import { DrawerPanel } from './DrawerPanel.tsx'
import { type AccentId, accentColor } from '../theme.ts'

interface ExtensionSettings {
  workDuration: number
  breakDuration: number
  longBreakDuration: number
  longBreakInterval: number
  autoStart: boolean
  autoPause: boolean
  soundEnabled: boolean
  soundTheme: string
  zenMode: boolean
  accent: string
  platform?: string
}

const ACCENTS: { id: AccentId; label: string }[] = [
  { id: 'blue', label: 'Blue' },
  { id: 'purple', label: 'Purple' },
  { id: 'green', label: 'Green' },
  { id: 'pink', label: 'Pink' },
  { id: 'orange', label: 'Orange' },
  { id: 'teal', label: 'Teal' },
]

const SOUND_THEMES = [
  { id: 'bell', label: 'Bell' },
  { id: 'digital', label: 'Digital' },
  { id: 'nature', label: 'Nature' },
  { id: 'zen', label: 'Zen' },
  { id: 'soft', label: 'Soft' },
  { id: 'classic', label: 'Classic' },
]

interface SettingsPanelProps {
  open: boolean
  onClose: () => void
  onAccentChange?: (accent: string) => void
}

export function SettingsPanel({ open, onClose, onAccentChange }: SettingsPanelProps) {
  const [settings, setSettings] = useState<ExtensionSettings>({
    workDuration: 25,
    breakDuration: 5,
    longBreakDuration: 15,
    longBreakInterval: 4,
    autoStart: true,
    autoPause: true,
    soundEnabled: true,
    soundTheme: 'bell',
    zenMode: false,
    accent: 'blue',
    platform: undefined,
  })

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const msg = event.data
      if (msg.command === 'settingsUpdate') {
        setSettings(msg.settings)
        onAccentChange?.(msg.settings.accent)
      }
    }
    window.addEventListener('message', handler)
    postMessage({ command: 'getSettings' })
    return () => window.removeEventListener('message', handler)
  }, [onAccentChange])

  const updateSetting = useCallback((key: string, value: unknown) => {
    setSettings((prev) => ({ ...prev, [key]: value }))
    postMessage({ command: 'updateSetting', key, value })
    if (key === 'accent' && typeof value === 'string') {
      onAccentChange?.(value)
    }
  }, [onAccentChange])

  return (
    <DrawerPanel title="Settings" open={open} onClose={onClose}>
      <Section title="Duration">
        <Slider label="Work (min)" value={settings.workDuration} min={1} max={180} step={1} onChange={(v) => updateSetting('workDuration', v)} />
        <Slider label="Break (min)" value={settings.breakDuration} min={0.25} max={60} step={0.25} onChange={(v) => updateSetting('breakDuration', v)} />
        <Slider label="Long break (min)" value={settings.longBreakDuration} min={0.25} max={120} step={0.25} onChange={(v) => updateSetting('longBreakDuration', v)} />
        <Slider label="Interval (sessions)" value={settings.longBreakInterval} min={1} max={10} step={1} onChange={(v) => updateSetting('longBreakInterval', v)} />
      </Section>

      <Section title="Behavior">
        <Toggle label="Auto-start" value={settings.autoStart} onChange={(v) => updateSetting('autoStart', v)} />
        <Toggle label="Auto-pause" value={settings.autoPause} onChange={(v) => updateSetting('autoPause', v)} />
        <Toggle
          label="Zen mode"
          hint="Hides sidebar/panels while focusing; exits on pause or break"
          value={settings.zenMode}
          onChange={(v) => updateSetting('zenMode', v)}
        />
      </Section>

      <Section title="Sound">
        <Toggle label="Enabled" value={settings.soundEnabled} onChange={(v) => updateSetting('soundEnabled', v)} />
        {!settings.soundEnabled && (
          <p className="text-[10px] mt-1" style={{ color: 'var(--text-tertiary)' }}>
            Preview still plays when you pick a theme
          </p>
        )}
        {settings.platform === 'win32' && (
          <p className="text-[10px] mt-1" style={{ color: 'var(--text-tertiary)' }}>
            On Windows, preview and completion use matching system beeps per theme
          </p>
        )}
        <div className="flex flex-wrap gap-1.5 mt-2">
          {SOUND_THEMES.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                updateSetting('soundTheme', t.id)
                // Host preview: Windows beeps match completion; other OS → Web Audio
                postMessage({ command: 'previewSound', theme: t.id, type: 'break' })
              }}
              className="text-[10px] px-2.5 py-1 rounded font-medium cursor-pointer border transition-colors"
              style={{
                background: settings.soundTheme === t.id ? 'var(--accent-soft)' : 'transparent',
                color: settings.soundTheme === t.id ? 'var(--accent)' : 'var(--text-secondary)',
                borderColor: settings.soundTheme === t.id ? 'color-mix(in srgb, var(--accent) 35%, transparent)' : 'var(--border-subtle)',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </Section>

      <Section title="Accent">
        <div className="flex gap-2 flex-wrap">
          {ACCENTS.map((a) => (
            <button
              key={a.id}
              onClick={() => updateSetting('accent', a.id)}
              className="w-7 h-7 rounded-full border-2 cursor-pointer transition-transform"
              style={{
                backgroundColor: accentColor(a.id),
                borderColor: settings.accent === a.id ? 'var(--text)' : 'transparent',
                transform: settings.accent === a.id ? 'scale(1.1)' : undefined,
              }}
              aria-label={a.label}
            />
          ))}
        </div>
      </Section>
    </DrawerPanel>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <h3 className="section-label">{title}</h3>
      <div className="space-y-3">{children}</div>
    </div>
  )
}

function Slider({ label, value, min, max, step, onChange }: {
  label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void
}) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-2">
      <span className="shrink-0 text-xs" style={{ color: 'var(--text-secondary)', width: '7.5rem' }}>{label}</span>
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className="h-1 min-w-0 flex-1 cursor-pointer"
          style={{ accentColor: 'var(--accent)' }}
        />
        <span className="w-10 shrink-0 text-right text-xs tabular-nums" style={{ color: 'var(--text-tertiary)' }}>{value}</span>
      </div>
    </div>
  )
}

function Toggle({
  label,
  hint,
  value,
  onChange,
}: {
  label: string
  hint?: string
  value: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{label}</span>
        {hint ? (
          <p className="text-[10px] mt-0.5 leading-snug" style={{ color: 'var(--text-tertiary)' }}>{hint}</p>
        ) : null}
      </div>
      <button
        type="button"
        onClick={() => onChange(!value)}
        className="relative w-9 h-5 rounded-full cursor-pointer transition-colors duration-200 shrink-0"
        style={{ background: value ? 'var(--accent)' : 'var(--border-subtle)' }}
        role="switch"
        aria-checked={value}
        aria-label={label}
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
