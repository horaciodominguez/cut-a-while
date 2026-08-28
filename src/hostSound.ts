import { exec } from 'node:child_process';

/** OS-level fallback when the webview panel is hidden or audio is blocked. */
export function playHostCompletionSound(type: 'work' | 'break'): void {
  const freq = type === 'work' ? 880 : 660;

  if (process.platform === 'win32') {
    exec(
      `powershell -NoProfile -Command "[console]::beep(${freq},280)"`,
      { windowsHide: true },
    );
    return;
  }

  if (process.platform === 'darwin') {
    exec('afplay /System/Library/Sounds/Glass.aiff', { windowsHide: true });
  }
}
