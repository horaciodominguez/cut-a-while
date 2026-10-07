import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const harness = vi.hoisted(() => ({
  listeners: [] as Array<(state: { focused: boolean }) => void>,
  config: {
    autoPause: true,
    workDuration: 25,
    breakDuration: 5,
    longBreakDuration: 15,
    longBreakInterval: 4,
    autoStart: true,
  } as Record<string, unknown>,
}))

vi.mock('vscode', () => {
  class EventEmitter<T> {
    private listeners: Array<(e: T) => void> = []
    event = (listener: (e: T) => void) => {
      this.listeners.push(listener)
      return {
        dispose: () => {
          const i = this.listeners.indexOf(listener)
          if (i >= 0) this.listeners.splice(i, 1)
        },
      }
    }
    fire(e: T) {
      this.listeners.forEach((l) => l(e))
    }
    dispose() {
      this.listeners = []
    }
  }

  return {
    EventEmitter,
    window: {
      onDidChangeWindowState: (cb: (state: { focused: boolean }) => void) => {
        harness.listeners.push(cb)
        return {
          dispose: () => {
            harness.listeners = harness.listeners.filter((l) => l !== cb)
          },
        }
      },
    },
    workspace: {
      getConfiguration: () => ({
        get: (key: string, defaultValue?: unknown) => harness.config[key] ?? defaultValue,
      }),
    },
  }
})

vi.mock('../src/notifications.js', () => ({
  Notifications: {
    confirm: vi.fn(() => Promise.resolve('Resume')),
  },
}))

import type { Memento } from 'vscode'
import { AutoPauseManager } from '../src/autoPauseManager.js'
import { TimerManager } from '../src/timer/timerManager.js'

function createStorage() {
  const store: Record<string, unknown> = {}
  return {
    get: <T>(key: string, defaultValue: T) => (store[key] as T) ?? defaultValue,
    set: async (key: string, value: unknown) => {
      store[key] = value
    },
    pushToArray: async (key: string, value: unknown) => {
      const arr = (store[key] as unknown[]) ?? []
      arr.push(value)
      store[key] = arr
    },
    getWorkspace: () => ({}),
    setWorkspace: async () => {},
  }
}

describe('AutoPauseManager', () => {
  let timer: TimerManager
  let autoPause: AutoPauseManager

  beforeEach(() => {
    vi.useFakeTimers()
    harness.listeners = []
    harness.config.autoPause = true
    harness.config.autoStart = true
    timer = new TimerManager(createStorage() as unknown as Memento)
    autoPause = new AutoPauseManager(timer)
  })

  afterEach(() => {
    autoPause.dispose()
    timer.dispose()
    vi.useRealTimers()
  })

  function blur() {
    harness.listeners[0]?.({ focused: false })
  }

  function focus() {
    harness.listeners[0]?.({ focused: true })
  }

  it('pauses a running focus session when the window blurs', () => {
    timer.start()
    blur()
    expect(timer.getState().status).toBe('paused')
    expect(timer.getState().cycleType).toBe('work')
  })

  it('pauses a break when the window blurs', async () => {
    timer.start()
    await vi.advanceTimersByTimeAsync(25 * 60 * 1000)
    expect(timer.getState().status).toBe('break')
    blur()
    expect(timer.getState().status).toBe('paused')
    expect(timer.getState().cycleType).toBe('break')
  })

  it('does not pause when autoPause is off', () => {
    harness.config.autoPause = false
    timer.start()
    blur()
    expect(timer.getState().status).toBe('running')
  })

  it('resumes after the user confirms on focus', async () => {
    const { Notifications } = await import('../src/notifications.js')
    timer.start('focus task')
    vi.advanceTimersByTime(3000)
    const left = timer.getState().timeLeft
    blur()
    expect(timer.getState()).toMatchObject({ status: 'paused', cycleType: 'work', timeLeft: left, currentTask: 'focus task' })
    focus()
    await vi.waitFor(() => {
      expect(timer.getState().status).toBe('running')
    })
    expect(timer.getState().timeLeft).toBe(left)
    expect(timer.getState().currentTask).toBe('focus task')
    expect(Notifications.confirm).toHaveBeenCalledTimes(1)
    expect(Notifications.confirm).toHaveBeenCalledWith(
      'Focus time paused while you were away. Resume?',
      'Resume',
    )
  })

  it('resumes a paused break back to the break, not a new focus', async () => {
    const { Notifications } = await import('../src/notifications.js')
    timer.start('reading')
    await vi.advanceTimersByTimeAsync(25 * 60 * 1000)
    const left = timer.getState().timeLeft
    blur()
    focus()
    await vi.waitFor(() => {
      expect(timer.getState().status).toBe('break')
    })
    expect(timer.getState()).toMatchObject({
      status: 'break',
      cycleType: 'break',
      timeLeft: left,
      currentTask: 'reading',
    })
    expect(Notifications.confirm).toHaveBeenCalledWith(
      'Break paused while you were away. Resume?',
      'Resume',
    )
  })

  it('does not ask again when the session was already resumed', async () => {
    const { Notifications } = await import('../src/notifications.js')
    const confirm = vi.mocked(Notifications.confirm)
    confirm.mockClear()
    timer.start()
    blur()
    timer.resume()
    focus()
    await Promise.resolve()
    expect(confirm).not.toHaveBeenCalled()
    expect(timer.getState().status).toBe('running')
  })

  it('asks again on the next focus if Resume was dismissed', async () => {
    const { Notifications } = await import('../src/notifications.js')
    const confirm = vi.mocked(Notifications.confirm)
    confirm.mockClear()
    confirm.mockResolvedValueOnce(undefined).mockResolvedValueOnce('Resume')

    timer.start()
    blur()
    focus()
    await Promise.resolve()
    expect(timer.getState().status).toBe('paused')

    focus()
    await vi.waitFor(() => {
      expect(timer.getState().status).toBe('running')
    })
    expect(Notifications.confirm).toHaveBeenCalledTimes(2)
  })
})
