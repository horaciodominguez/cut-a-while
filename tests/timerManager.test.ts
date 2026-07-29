import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

type ConfigStore = Record<string, unknown>
let configStore: ConfigStore = {}

vi.mock('vscode', () => {
  class EventEmitter<T> {
    private listeners: Array<(e: T) => void> = []
    event = (listener: (e: T) => void) => {
      this.listeners.push(listener)
      return { dispose: () => { const i = this.listeners.indexOf(listener); if (i >= 0) this.listeners.splice(i, 1) } }
    }
    fire(e: T) { this.listeners.forEach(l => l(e)) }
    dispose() { this.listeners = [] }
  }

  return {
    EventEmitter,
    workspace: {
      getConfiguration: vi.fn(() => ({
        get: vi.fn((key: string, defaultValue?: unknown) => {
          const shortKey = key.replace('cut-a-while.', '')
          return configStore[shortKey] ?? defaultValue
        }),
      })),
    },
  }
})

import type { Memento } from 'vscode'
import { TimerManager } from '../src/timer/timerManager.js'

interface MockStorage {
  get: ReturnType<typeof vi.fn>
  set: ReturnType<typeof vi.fn>
  pushToArray: ReturnType<typeof vi.fn>
  getWorkspace: ReturnType<typeof vi.fn>
  setWorkspace: ReturnType<typeof vi.fn>
}

function createMockStorage(): MockStorage {
  const store: Record<string, unknown> = {}
  return {
    get: vi.fn(<T>(key: string, defaultValue: T) => (store[key] as T) ?? defaultValue),
    set: vi.fn(async (key: string, value: unknown) => { store[key] = value }),
    pushToArray: vi.fn(async (key: string, value: unknown) => {
      const arr = (store[key] as unknown[]) ?? []
      arr.push(value)
      store[key] = arr
    }),
    getWorkspace: vi.fn(),
    setWorkspace: vi.fn(),
  }
}

describe('TimerManager', () => {
  let timer: TimerManager
  let storage: MockStorage

  beforeEach(() => {
    vi.useFakeTimers()
    configStore = {
      workDuration: 25,
      breakDuration: 5,
      longBreakDuration: 15,
      longBreakInterval: 4,
      autoStart: true,
    }
    storage = createMockStorage()
    timer = new TimerManager(storage as unknown as Memento)
  })

  afterEach(() => {
    timer.dispose()
    vi.useRealTimers()
  })

  it('starts in idle state with work cycle', () => {
    const state = timer.getState()
    expect(state.status).toBe('idle')
    expect(state.cycleType).toBe('work')
    expect(state.timeLeft).toBe(25 * 60)
    expect(state.completedSessions).toBe(0)
    expect(state.currentTask).toBe('')
  })

  it('transitions to running on start', () => {
    timer.start()
    const state = timer.getState()
    expect(state.status).toBe('running')
    expect(state.cycleType).toBe('work')
  })

  it('does not start if already running', () => {
    timer.start()
    const timeLeft = timer.getState().timeLeft
    timer.start()
    expect(timer.getState().timeLeft).toBe(timeLeft)
  })

  it('pauses a running timer', () => {
    timer.start()
    timer.pause()
    expect(timer.getState().status).toBe('paused')
  })

  it('does not pause if not running', () => {
    timer.pause()
    expect(timer.getState().status).toBe('idle')
    timer.start()
    timer.stop()
    timer.pause()
    expect(timer.getState().status).toBe('stopped')
  })

  it('resumes from paused', () => {
    timer.start()
    timer.pause()
    timer.resume()
    expect(timer.getState().status).toBe('running')
  })

  it('does not resume if not paused', () => {
    timer.resume()
    expect(timer.getState().status).toBe('idle')
  })

  it('stops the timer', () => {
    timer.start()
    timer.stop()
    expect(timer.getState().status).toBe('stopped')
    expect(timer.getState().timeLeft).toBe(25 * 60)
  })

  it('resets to idle initial state', () => {
    timer.start()
    vi.advanceTimersByTime(5000)
    timer.reset()
    const state = timer.getState()
    expect(state.status).toBe('idle')
    expect(state.timeLeft).toBe(25 * 60)
    expect(state.completedSessions).toBe(0)
    expect(state.currentTask).toBe('')
  })

  it('counts down every second', () => {
    timer.start()
    vi.advanceTimersByTime(3000)
    expect(timer.getState().timeLeft).toBe(25 * 60 - 3)
  })

  it('transitions to break when work completes', async () => {
    timer.start('test task')
    await vi.advanceTimersByTimeAsync(25 * 60 * 1000)
    const state = timer.getState()
    expect(state.status).toBe('break')
    expect(state.cycleType).toBe('break')
    expect(state.timeLeft).toBe(5 * 60)
    expect(state.completedSessions).toBe(1)
  })

  it('saves session on work completion', async () => {
    timer.start('test')
    await vi.advanceTimersByTimeAsync(25 * 60 * 1000)
    expect(storage.pushToArray).toHaveBeenCalledWith('sessions', expect.objectContaining({
      type: 'work',
      task: 'test',
    }))
  })

  it('uses long break duration after configured interval', async () => {
    configStore.longBreakInterval = 1
    configStore.longBreakDuration = 15
    configStore.autoStart = false

    const timer2 = new TimerManager(storage as unknown as Memento)
    timer2.start()
    await vi.advanceTimersByTimeAsync(25 * 60 * 1000)
    expect(timer2.getState().timeLeft).toBe(15 * 60)
    expect(timer2.getState().cycleType).toBe('break')
    timer2.dispose()
  })

  it('auto-starts next work session after break when autoStart is true', async () => {
    timer.start()
    await vi.advanceTimersByTimeAsync(25 * 60 * 1000)

    const breakState = timer.getState()
    expect(breakState.status).toBe('break')

    await vi.advanceTimersByTimeAsync(5 * 60 * 1000)
    const workState = timer.getState()
    expect(workState.status).toBe('running')
    expect(workState.cycleType).toBe('work')
    expect(workState.timeLeft).toBe(25 * 60)
  })

  it('does not auto-start when autoStart is false', async () => {
    configStore.autoStart = false
    const timer2 = new TimerManager(storage as unknown as Memento)
    timer2.start()
    await vi.advanceTimersByTimeAsync(25 * 60 * 1000)
    expect(timer2.getState().status).toBe('break')
    timer2.dispose()
  })

  it('skipBreak transitions from break to running work', async () => {
    timer.start()
    await vi.advanceTimersByTimeAsync(25 * 60 * 1000)
    timer.skipBreak()
    const state = timer.getState()
    expect(state.status).toBe('running')
    expect(state.cycleType).toBe('work')
    expect(state.timeLeft).toBe(25 * 60)
  })

  it('setTask updates current task', () => {
    timer.setTask('my task')
    expect(timer.getState().currentTask).toBe('my task')
  })

  it('emits state changes', () => {
    const listener = vi.fn()
    const disposable = timer.onDidChangeState(listener)
    timer.start()
    expect(listener).toHaveBeenCalledWith(expect.objectContaining({ status: 'running' }))
    disposable.dispose()
  })

  it('stops emitting after dispose', () => {
    const listener = vi.fn()
    timer.onDidChangeState(listener)
    timer.dispose()
    vi.advanceTimersByTime(5000)
    expect(listener).toHaveBeenCalledTimes(0)
  })

  it('dispose cleans up and stops the interval', () => {
    timer.start()
    timer.dispose()
    vi.advanceTimersByTime(5000)
    expect(timer.getState().timeLeft).toBe(25 * 60)
  })

  it('handles multiple start-stop cycles', () => {
    timer.start()
    vi.advanceTimersByTime(10000)
    timer.stop()
    expect(timer.getState().status).toBe('stopped')

    timer.start()
    expect(timer.getState().status).toBe('running')
    expect(timer.getState().timeLeft).toBe(25 * 60)
  })

  it('preserves task through start', () => {
    timer.setTask('my task')
    timer.start()
    expect(timer.getState().currentTask).toBe('my task')
  })

  it('stops counting when paused', () => {
    timer.start()
    vi.advanceTimersByTime(5000)
    timer.pause()
    vi.advanceTimersByTime(5000)
    expect(timer.getState().status).toBe('paused')
    expect(timer.getState().timeLeft).toBe(25 * 60 - 5)
  })

  it('resets completedSessions on reset', async () => {
    timer.start()
    await vi.advanceTimersByTimeAsync(25 * 60 * 1000)
    expect(timer.getState().completedSessions).toBe(1)
    timer.reset()
    expect(timer.getState().completedSessions).toBe(0)
  })
})
