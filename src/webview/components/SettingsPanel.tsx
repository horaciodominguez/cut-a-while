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
  statusBarAlignment: string
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
    statusBarAlignment: 'right',
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
        <Slider label="Work (min)" value={settings.workDuration} min={1} max={180} step={1} onCommit={(v) => updateSetting('workDuration', v)} />
        <Slider label="Break (min)" value={settings.breakDuration} min={0.25} max={60} step={0.25} onCommit={(v) => updateSetting('breakDuration', v)} />
        <Slider label="Long break (min)" value={settings.longBreakDuration} min={0.25} max={120} step={0.25} onCommit={(v) => updateSetting('longBreakDuration', v)} />
        <Slider
          label="Interval"
          hint="Work sessions before a long break"
          value={settings.longBreakInterval}
          min={1}
          max={10}
          step={1}
          onCommit={(v) => updateSetting('longBreakInterval', v)}
        />
        <p className="text-[10px] leading-snug" style={{ color: 'var(--text-tertiary)' }}>
          Applies to the next session.
        </p>
      </Section>

      <Section title="Behavior">
        <Toggle
          label="Auto-start"
          hint="Breaks always start. This starts the next focus."
          value={settings.autoStart}
          onChange={(v) => updateSetting('autoStart', v)}
        />
        <Toggle
          label="Auto-pause"
          hint="Pauses when the window loses focus."
          value={settings.autoPause}
          onChange={(v) => updateSetting('autoPause', v)}
        />
        <Toggle
          label="Zen mode"
          hint="Hides sidebar and panels while focusing. Exits on pause or break. With auto-pause on, leaving the window also exits Zen."
          value={settings.zenMode}
          onChange={(v) => updateSetting('zenMode', v)}
        />
        <div className="flex items-center justify-between gap-3">
          <span className="min-w-0">
            <span className="block text-xs" style={{ color: 'var(--text-secondary)' }}>Status bar</span>
            <span className="block text-[10px] mt-0.5 leading-snug" style={{ color: 'var(--text-tertiary)' }}>
              Left or right side of the status bar.
            </span>
          </span>
          <div className="flex gap-1 shrink-0">
            {(['left', 'right'] as const).map((side) => (
              <button
                key={side}
                type="button"
                aria-pressed={settings.statusBarAlignment === side}
                onClick={() => updateSetting('statusBarAlignment', side)}
                className="text-[10px] px-2.5 py-1 rounded font-medium cursor-pointer border capitalize"
                style={{
                  background: settings.statusBarAlignment === side ? 'var(--accent-soft)' : 'transparent',
                  color: settings.statusBarAlignment === side ? 'var(--accent)' : 'var(--text-secondary)',
                  borderColor: settings.statusBarAlignment === side
                    ? 'color-mix(in srgb, var(--accent) 35%, transparent)'
                    : 'var(--border-subtle)',
                }}
              >
                {side}
              </button>
            ))}
          </div>
        </div>
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
        {settings.platform === 'darwin' && (
          <p className="text-[10px] mt-1" style={{ color: 'var(--text-tertiary)' }}>
            On macOS, host completion uses one system sound; theme preview needs the panel visible
          </p>
        )}
        {settings.platform === 'linux' && (
          <p className="text-[10px] mt-1" style={{ color: 'var(--text-tertiary)' }}>
            On Linux, completion sound plays when the timer panel is visible
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
                postMessage({ command: 'previewSound', theme: t.id, type: 'work' })
              }}
              aria-pressed={settings.soundTheme === t.id}
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
              aria-pressed={settings.accent === a.id}
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

function Slider({ label, hint, value, min, max, step, onCommit }: {
  label: string
  hint?: string
  value: number
  min: number
  max: number
  step: number
  onCommit: (v: number) => void
}) {
  const [draft, setDraft] = useState(value)
  useEffect(() => setDraft(value), [value])

  const commit = (raw: string) => {
    const next = parseFloat(raw)
    if (Number.isNaN(next) || next === value) return
    onCommit(next)
  }

  return (
    <div className="min-w-0">
      <div className="flex min-w-0 items-center justify-between gap-2">
        <span className="shrink-0 text-xs" style={{ color: 'var(--text-secondary)', width: '7.5rem' }}>{label}</span>
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={draft}
            aria-label={label}
            onChange={(e) => setDraft(parseFloat(e.target.value))}
            onPointerUp={(e) => commit(e.currentTarget.value)}
            onKeyUp={(e) => commit(e.currentTarget.value)}
            onBlur={(e) => commit(e.currentTarget.value)}
            className="h-1 min-w-0 flex-1 cursor-pointer"
            style={{ accentColor: 'var(--accent)' }}
          />
          <span className="w-10 shrink-0 text-right text-xs tabular-nums" style={{ color: 'var(--text-tertiary)' }}>{draft}</span>
        </div>
      </div>
      {hint ? (
        <p className="text-[10px] mt-0.5 leading-snug" style={{ color: 'var(--text-tertiary)' }}>{hint}</p>
      ) : null}
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
    <button
      type="button"
      onClick={() => onChange(!value)}
      className="flex w-full items-center justify-between gap-3 text-left cursor-pointer bg-transparent border-0 p-0"
      role="switch"
      aria-checked={value}
    >
      <span className="min-w-0">
        <span className="block text-xs" style={{ color: 'var(--text-secondary)' }}>{label}</span>
        {hint ? (
          <span className="block text-[10px] mt-0.5 leading-snug" style={{ color: 'var(--text-tertiary)' }}>{hint}</span>
        ) : null}
      </span>
      <span
        aria-hidden="true"
        className="relative w-9 h-5 rounded-full shrink-0"
        style={{ background: value ? 'var(--accent)' : 'var(--border-subtle)' }}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform duration-200 ${
            value ? 'translate-x-4' : 'translate-x-0'
          }`}
        />
      </span>
    </button>
  )
}
