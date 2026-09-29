import { exec, type ChildProcess } from 'node:child_process';

type BeepPattern = { freq: number; ms: number }[];

/** Distinct Windows beep patterns per sound theme (webview audio is unreliable without focus). */
const WIN_THEMES: Record<string, { work: BeepPattern; break: BeepPattern }> = {
  bell: {
    work: [{ freq: 880, ms: 280 }],
    break: [{ freq: 660, ms: 280 }],
  },
  digital: {
    work: [
      { freq: 1200, ms: 80 },
      { freq: 1400, ms: 80 },
      { freq: 1600, ms: 100 },
    ],
    break: [
      { freq: 900, ms: 80 },
      { freq: 700, ms: 120 },
    ],
  },
  nature: {
    work: [{ freq: 523, ms: 350 }],
    break: [{ freq: 392, ms: 350 }],
  },
  zen: {
    work: [{ freq: 440, ms: 420 }],
    break: [{ freq: 330, ms: 420 }],
  },
  soft: {
    work: [{ freq: 600, ms: 200 }],
    break: [{ freq: 500, ms: 200 }],
  },
  classic: {
    work: [
      { freq: 1000, ms: 150 },
      { freq: 800, ms: 200 },
    ],
    break: [{ freq: 750, ms: 250 }],
  },
};

const HOST_SOUND_TIMEOUT_MS = 5000;

let inFlight: ChildProcess | null = null;

export type CompletionSoundRoute = 'silent' | 'host' | 'webview' | 'both';

/** Where a cycle-completion sound should play. Windows always uses the host beep. */
export function resolveCompletionSoundRoute(input: {
  enabled: boolean;
  platform: NodeJS.Platform;
  hasWebview: boolean;
  panelVisible: boolean;
}): CompletionSoundRoute {
  if (!input.enabled) return 'silent';
  if (input.platform === 'win32') return 'host';
  if (!input.hasWebview) return 'host';
  if (!input.panelVisible) return 'both';
  return 'webview';
}

export function resolvePreviewSoundRoute(
  platform: NodeJS.Platform,
  hasWebview: boolean,
): 'host' | 'webview' {
  if (platform === 'win32' || !hasWebview) return 'host';
  return 'webview';
}

function winBeepScript(pattern: BeepPattern): string {
  const lines = pattern.map((p) => `[console]::beep(${p.freq},${p.ms})`);
  return lines.join('; ');
}

function spawnHostSound(command: string): void {
  if (inFlight) {
    try {
      inFlight.kill();
    } catch {
      // Process already exited
    }
    inFlight = null;
  }

  const child = exec(
    command,
    { windowsHide: true, timeout: HOST_SOUND_TIMEOUT_MS },
    (error) => {
      if (inFlight === child) inFlight = null;
      if (error && process.env.CUT_A_WHILE_SOUND_DEBUG === '1') {
        console.error('[cut-a-while] host sound failed:', error.message);
      }
    },
  );
  inFlight = child;
  child.on('error', () => {
    if (inFlight === child) inFlight = null;
  });
}

/** OS-level fallback when the webview panel is hidden or audio is blocked. */
export function playHostCompletionSound(
  type: 'work' | 'break',
  theme = 'bell',
): void {
  if (process.platform === 'win32') {
    const patterns = WIN_THEMES[theme] ?? WIN_THEMES.bell!;
    const pattern = patterns[type];
    spawnHostSound(`powershell -NoProfile -Command "${winBeepScript(pattern)}"`);
    return;
  }

  if (process.platform === 'darwin') {
    spawnHostSound('afplay /System/Library/Sounds/Glass.aiff');
  }
}

/** Test hook: drop the in-flight handle without killing a real process twice. */
export function resetHostSoundForTests(): void {
  inFlight = null;
}
