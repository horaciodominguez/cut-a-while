import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const harness = vi.hoisted(() => ({
  items: [] as Array<{
    text: string
    tooltip: string
    command: string
    color: string | undefined
    backgroundColor: { id: string } | undefined
    show: ReturnType<typeof vi.fn>
    dispose: ReturnType<typeof vi.fn>
  }>,
  config: {
    workDuration: 25,
    breakDuration: 5,
    longBreakDuration: 15,
    longBreakInterval: 4,
    autoStart: false,
    statusBarAlignment: 'right',
  } as Record<string, unknown>,
}))

vi.mock('vscode', () => {
  class EventEmitter<T> {
    private listeners: Array<(e: T) => void> = []
    event = (listener: (e: T) => void) => {
      this.listeners.push(listener)
      return { dispose: () => { const i = this.listeners.indexOf(listener); if (i >= 0) this.listeners.splice(i, 1) } }
    }
    fire(e: T) { this.listeners.forEach((l) => l(e)) }
    dispose() { this.listeners = [] }
  }

  class ThemeColor {
    constructor(public id: string) {}
  }

  return {
    EventEmitter,
    ThemeColor,
    StatusBarAlignment: { Left: 1, Right: 2 },
    window: {
      createStatusBarItem: () => {
        const item = {
          text: '',
          tooltip: '',
          command: '',
          color: undefined as string | undefined,
          backgroundColor: undefined as { id: string } | undefined,
          show: vi.fn(),
          dispose: vi.fn(),
        }
        harness.items.push(item)
        return item
      },
    },
    workspace: {
      getConfiguration: () => ({
        get: (key: string, defaultValue?: unknown) => harness.config[key] ?? defaultValue,
      }),
      onDidChangeConfiguration: () => ({ dispose: () => {} }),
    },
  }
})

import type { Memento } from 'vscode'
import { StatusBarManager } from '../src/statusBar.js'
import { TimerManager } from '../src/timer/timerManager.js'

function createStorage() {
  const store: Record<string, unknown> = {}
  return {
    get: <T>(key: string, defaultValue: T) => (store[key] as T) ?? defaultValue,
    set: async (key: string, value: unknown) => { store[key] = value },
    pushToArray: async (key: string, value: unknown) => {
      const arr = (store[key] as unknown[]) ?? []
      arr.push(value)
      store[key] = arr
    },
  }
}

describe('StatusBarManager', () => {
  let timer: TimerManager
  let bar: StatusBarManager

  beforeEach(() => {
    vi.useFakeTimers()
    harness.items.length = 0
    harness.config.longBreakInterval = 4
    harness.config.autoStart = false
    timer = new TimerManager(createStorage() as unknown as Memento)
    bar = new StatusBarManager(timer)
    bar.init()
  })

  afterEach(() => {
    bar.dispose()
    timer.dispose()
    vi.useRealTimers()
  })

  function item() {
    return harness.items[harness.items.length - 1]
  }

  it('shows the idle clock without a highlighted background', () => {
    expect(item().text).toBe('$(watch) 25:00')
    expect(item().backgroundColor).toBeUndefined()
    expect(item().command).toBe('cut-a-while.showPanel')
    expect(item().tooltip).toBe(
      [
        'Cut a While — Focus',
        '25:00 remaining',
        'This cycle: 0',
        '4 until long break',
        '---',
        'Click to open panel',
      ].join('\n'),
    )
  })

  it('highlights only while focus is running and never starts a blink interval', () => {
    const interval = vi.spyOn(global, 'setInterval')
    timer.start()
    expect(item().text).toBe('$(play-circle) 25:00')
    expect(item().backgroundColor).toEqual({ id: 'statusBarItem.prominentBackground' })
    expect(interval).not.toHaveBeenCalled()

    timer.pause()
    expect(item().text).toBe('$(debug-pause) 25:00')
    expect(item().color).toBe('#ffb74d')
    expect(item().backgroundColor).toBeUndefined()
    expect(interval).not.toHaveBeenCalled()
    interval.mockRestore()
  })

  it('says Long break only during that break', async () => {
    harness.config.workDuration = 1 / 60
    harness.config.breakDuration = 1 / 60
    harness.config.longBreakDuration = 2 / 60
    harness.config.longBreakInterval = 4
    harness.config.autoStart = true
    timer.dispose()
    bar.dispose()
    harness.items.length = 0
    timer = new TimerManager(createStorage() as unknown as Memento)
    bar = new StatusBarManager(timer)
    bar.init()
    timer.start()

    for (let i = 0; i < 3; i++) {
      await vi.advanceTimersByTimeAsync(1000)
      await vi.advanceTimersByTimeAsync(1000)
    }
    await vi.advanceTimersByTimeAsync(1000)

    expect(timer.getState()).toMatchObject({ status: 'break', completedSessions: 4, timeLeft: 2 })
    expect(item().text).toBe('$(coffee) 00:02')
    expect(item().backgroundColor).toBeUndefined()
    expect(item().tooltip).toBe(
      [
        'Cut a While — Long break',
        '00:02 remaining',
        'This cycle: 4',
        'Long break',
        '---',
        'Click to open panel',
      ].join('\n'),
    )
    expect(item().tooltip).not.toContain('Long break now!')
  })
})
