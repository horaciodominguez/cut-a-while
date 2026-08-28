export type SoundTheme = 'bell' | 'digital' | 'nature' | 'zen' | 'soft' | 'classic'

let audioCtx: AudioContext | null = null

async function ensureAudioCtx(): Promise<AudioContext | null> {
  try {
    if (!audioCtx) {
      audioCtx = new AudioContext()
    }
    if (audioCtx.state === 'suspended') {
      await audioCtx.resume()
    }
    return audioCtx
  } catch {
    return null
  }
}

async function beep(
  frequency: number,
  duration: number,
  type: OscillatorType = 'sine',
  volume = 0.18,
) {
  const ctx = await ensureAudioCtx()
  if (!ctx) return

  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.frequency.value = frequency
  osc.type = type
  gain.gain.setValueAtTime(volume, ctx.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration)
  osc.start()
  osc.stop(ctx.currentTime + duration)
}

function scheduleBeep(
  delay: number,
  frequency: number,
  duration: number,
  type: OscillatorType,
  volume: number,
) {
  setTimeout(() => {
    void beep(frequency, duration, type, volume)
  }, delay)
}

const THEMES: Record<SoundTheme, { work: () => Promise<void>; break: () => Promise<void> }> = {
  bell: {
    work: async () => {
      await beep(880, 0.3, 'sine')
      scheduleBeep(150, 1100, 0.4, 'sine', 0.18)
    },
    break: async () => {
      await beep(660, 0.25, 'triangle')
    },
  },
  digital: {
    work: async () => {
      await beep(1000, 0.1, 'square')
      scheduleBeep(100, 1200, 0.1, 'square', 0.12)
      scheduleBeep(200, 1400, 0.15, 'square', 0.12)
    },
    break: async () => {
      await beep(800, 0.1, 'square')
    },
  },
  nature: {
    work: async () => {
      await beep(500, 0.4, 'triangle')
      scheduleBeep(200, 700, 0.3, 'triangle', 0.12)
    },
    break: async () => {
      await beep(400, 0.35, 'triangle')
    },
  },
  zen: {
    work: async () => {
      await beep(440, 0.8, 'sine', 0.14)
    },
    break: async () => {
      await beep(330, 0.6, 'sine', 0.12)
    },
  },
  soft: {
    work: async () => {
      await beep(660, 0.2, 'sine')
      scheduleBeep(200, 880, 0.25, 'sine', 0.12)
    },
    break: async () => {
      await beep(550, 0.2, 'sine')
    },
  },
  classic: {
    work: async () => {
      await beep(750, 0.15, 'sine')
      scheduleBeep(120, 1000, 0.15, 'sine', 0.18)
      scheduleBeep(240, 1250, 0.2, 'sine', 0.18)
    },
    break: async () => {
      await beep(620, 0.12, 'sine')
    },
  },
}

function isSoundTheme(value: string): value is SoundTheme {
  return value in THEMES
}

/** Resume AudioContext after user gesture or when the panel becomes visible again. */
export function unlockAudio(): void {
  void ensureAudioCtx()
}

if (typeof document !== 'undefined') {
  document.addEventListener('pointerdown', unlockAudio, { once: false, passive: true })
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      unlockAudio()
    }
  })
}

export async function playCycleSound(
  theme: string,
  type: 'work' | 'break',
  enabled = true,
): Promise<void> {
  if (!enabled) return
  const resolved = isSoundTheme(theme) ? theme : 'bell'
  await THEMES[resolved][type]()
}

export function playThemeSound(theme: SoundTheme, type: 'work' | 'break' = 'break', enabled = true) {
  void playCycleSound(theme, type, enabled)
}
