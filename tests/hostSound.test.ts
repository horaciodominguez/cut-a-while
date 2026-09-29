import { beforeEach, describe, expect, it, vi } from 'vitest'

const exec = vi.hoisted(() => vi.fn())

vi.mock('node:child_process', () => ({
  exec,
}))

import {
  playHostCompletionSound,
  resetHostSoundForTests,
  resolveCompletionSoundRoute,
  resolvePreviewSoundRoute,
} from '../src/hostSound.js'

function fakeChild() {
  return { kill: vi.fn(), on: vi.fn(), killed: false, exitCode: null as number | null }
}

describe('resolveCompletionSoundRoute', () => {
  it('stays silent when sound is disabled', () => {
    expect(
      resolveCompletionSoundRoute({
        enabled: false,
        platform: 'win32',
        hasWebview: true,
        panelVisible: true,
      }),
    ).toBe('silent')
  })

  it('uses the host beep on Windows even when the panel is visible', () => {
    expect(
      resolveCompletionSoundRoute({
        enabled: true,
        platform: 'win32',
        hasWebview: true,
        panelVisible: true,
      }),
    ).toBe('host')
  })

  it('uses the webview when the panel is visible on other platforms', () => {
    expect(
      resolveCompletionSoundRoute({
        enabled: true,
        platform: 'darwin',
        hasWebview: true,
        panelVisible: true,
      }),
    ).toBe('webview')
  })

  it('plays both when a non-Windows panel exists but is hidden', () => {
    expect(
      resolveCompletionSoundRoute({
        enabled: true,
        platform: 'linux',
        hasWebview: true,
        panelVisible: false,
      }),
    ).toBe('both')
  })

  it('falls back to the host when there is no webview', () => {
    expect(
      resolveCompletionSoundRoute({
        enabled: true,
        platform: 'linux',
        hasWebview: false,
        panelVisible: false,
      }),
    ).toBe('host')
  })
})

describe('resolvePreviewSoundRoute', () => {
  it('previews through the host on Windows', () => {
    expect(resolvePreviewSoundRoute('win32', true)).toBe('host')
  })

  it('previews in the webview elsewhere when the panel exists', () => {
    expect(resolvePreviewSoundRoute('darwin', true)).toBe('webview')
    expect(resolvePreviewSoundRoute('linux', false)).toBe('host')
  })
})

describe('playHostCompletionSound', () => {
  beforeEach(() => {
    resetHostSoundForTests()
    exec.mockReset()
    exec.mockImplementation(() => fakeChild())
  })

  const itHost = process.platform === 'win32' || process.platform === 'darwin' ? it : it.skip

  itHost('times out and kills a beep that is still in flight', () => {
    playHostCompletionSound('work', 'bell')
    const first = exec.mock.results[0]?.value as ReturnType<typeof fakeChild>
    playHostCompletionSound('break', 'digital')
    expect(first.kill).toHaveBeenCalled()
    expect(exec).toHaveBeenCalledTimes(2)
    expect(exec.mock.calls[0]?.[1]).toMatchObject({ timeout: 5000, windowsHide: true })
  })
})
