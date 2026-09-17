import { exec } from 'node:child_process';

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

function winBeepScript(pattern: BeepPattern): string {
  const lines = pattern.map((p) => `[console]::beep(${p.freq},${p.ms})`);
  return lines.join('; ');
}

/** OS-level fallback when the webview panel is hidden or audio is blocked. */
export function playHostCompletionSound(
  type: 'work' | 'break',
  theme = 'bell',
): void {
  if (process.platform === 'win32') {
    const patterns = WIN_THEMES[theme] ?? WIN_THEMES.bell!;
    const pattern = patterns[type];
    exec(
      `powershell -NoProfile -Command "${winBeepScript(pattern)}"`,
      { windowsHide: true },
    );
    return;
  }

  if (process.platform === 'darwin') {
    exec('afplay /System/Library/Sounds/Glass.aiff', { windowsHide: true });
  }
}
