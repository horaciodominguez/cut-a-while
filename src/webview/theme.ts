export type AccentId = 'blue' | 'purple' | 'green' | 'pink' | 'orange' | 'teal'

export const ACCENT_COLORS: Record<AccentId, string> = {
  blue: '#5b8def',
  purple: '#9d7cf6',
  green: '#16a34a',
  pink: '#f472b6',
  orange: '#fb923c',
  teal: '#2dd4bf',
}

/** Dark text on light accents so Start stays readable. */
export function accentForeground(hex: string): '#1a1a1a' | '#ffffff' {
  const raw = hex.replace('#', '')
  if (raw.length !== 6) return '#ffffff'
  const r = parseInt(raw.slice(0, 2), 16)
  const g = parseInt(raw.slice(2, 4), 16)
  const b = parseInt(raw.slice(4, 6), 16)
  if ([r, g, b].some((channel) => Number.isNaN(channel))) return '#ffffff'
  const luma = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
  return luma > 0.62 ? '#1a1a1a' : '#ffffff'
}

export const BREAK_ACCENT = '#34d399'

export function accentColor(id: string): string {
  return ACCENT_COLORS[id as AccentId] ?? ACCENT_COLORS.blue
}

export function applyAccent(id: string): void {
  const hex = accentColor(id)
  document.documentElement.style.setProperty('--accent', hex)
  document.documentElement.style.setProperty('--accent-soft', `color-mix(in srgb, ${hex} 14%, transparent)`)
  document.documentElement.style.setProperty('--on-accent', accentForeground(hex))
}
