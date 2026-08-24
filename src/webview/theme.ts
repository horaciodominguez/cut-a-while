export type AccentId = 'blue' | 'purple' | 'green' | 'pink' | 'orange' | 'teal'

export const ACCENT_COLORS: Record<AccentId, string> = {
  blue: '#3b82f6',
  purple: '#8b5cf6',
  green: '#10b981',
  pink: '#ec4899',
  orange: '#f97316',
  teal: '#14b8a6',
}

export const BREAK_ACCENT = '#10b981'

export function accentColor(id: string): string {
  return ACCENT_COLORS[id as AccentId] ?? ACCENT_COLORS.blue
}

export function applyAccent(id: string): void {
  document.documentElement.style.setProperty('--accent', accentColor(id))
}
