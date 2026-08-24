export type AccentId = 'blue' | 'purple' | 'green' | 'pink' | 'orange' | 'teal'

export const ACCENT_COLORS: Record<AccentId, string> = {
  blue: '#5b8def',
  purple: '#9d7cf6',
  green: '#34d399',
  pink: '#f472b6',
  orange: '#fb923c',
  teal: '#2dd4bf',
}

export const BREAK_ACCENT = '#34d399'

export function accentColor(id: string): string {
  return ACCENT_COLORS[id as AccentId] ?? ACCENT_COLORS.blue
}

export function applyAccent(id: string): void {
  const hex = accentColor(id)
  document.documentElement.style.setProperty('--accent', hex)
  document.documentElement.style.setProperty('--accent-soft', `color-mix(in srgb, ${hex} 14%, transparent)`)
  document.documentElement.style.setProperty('--accent-glow', `color-mix(in srgb, ${hex} 22%, transparent)`)
}
