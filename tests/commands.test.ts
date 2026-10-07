import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const harness = vi.hoisted(() => ({
  commands: new Map<string, (...args: unknown[]) => unknown>(),
  config: {
    workDuration: 25,
    breakDuration: 5,
    longBreakDuration: 15,
    longBreakInterval: 4,
    autoStart: true,
  } as Record<string, unknown>,
  showWarningMessage: vi.fn(),
  showInformationMessage: vi.fn(),
  executeCommand: vi.fn(),
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

  return {
    EventEmitter,
    commands: {
      registerCommand: (id: string, callback: (...args: unknown[]) => unknown) => {
        harness.commands.set(id, callback)
        return { dispose: () => harness.commands.delete(id) }
      },
      executeCommand: (...args: unknown[]) => harness.executeCommand(...args),
    },
    window: {
      showWarningMessage: (...args: unknown[]) => harness.showWarningMessage(...args),
      showInformationMessage: (...args: unknown[]) => harness.showInformationMessage(...args),
    },
    workspace: {
      getConfiguration: () => ({
        get: (key: string, defaultValue?: unknown) => harness.config[key] ?? defaultValue,
      }),
    },
  }
})

import type { ExtensionContext, Memento } from 'vscode'
import { CommandsManager } from '../src/commands.js'
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

describe('CommandsManager', () => {
  let timer: TimerManager
  let commands: CommandsManager

  beforeEach(() => {
    vi.useFakeTimers()
    harness.commands.clear()
    harness.showWarningMessage.mockReset()
    harness.showInformationMessage.mockReset()
    harness.executeCommand.mockReset()
    harness.config.autoStart = true
    timer = new TimerManager(createStorage() as unknown as Memento)
    commands = new CommandsManager(timer)
    commands.register({ subscriptions: [] } as unknown as ExtensionContext)
  })

  afterEach(() => {
    timer.dispose()
    vi.useRealTimers()
  })

  function toggle() {
    const command = harness.commands.get('cut-a-while.toggle')
    if (!command) throw new Error('toggle was not registered')
    command()
  }

  it('starts from idle and does not notify', () => {
    toggle()
    expect(timer.getState()).toMatchObject({ status: 'running', cycleType: 'work', timeLeft: 25 * 60 })
    expect(harness.showInformationMessage).not.toHaveBeenCalled()
    expect(harness.showWarningMessage).not.toHaveBeenCalled()
  })

  it('pauses a running focus and resumes the same countdown', () => {
    timer.start('chapter')
    vi.advanceTimersByTime(4000)
    const left = timer.getState().timeLeft
    toggle()
    expect(timer.getState()).toMatchObject({ status: 'paused', timeLeft: left, currentTask: 'chapter' })
    toggle()
    expect(timer.getState()).toMatchObject({ status: 'running', cycleType: 'work', timeLeft: left, currentTask: 'chapter' })
  })

  it('pauses a break instead of skipping it', async () => {
    timer.start('deep work')
    await vi.advanceTimersByTimeAsync(25 * 60 * 1000)
    const left = timer.getState().timeLeft
    toggle()
    expect(timer.getState()).toMatchObject({
      status: 'paused',
      cycleType: 'break',
      timeLeft: left,
      completedSessions: 1,
      currentTask: 'deep work',
    })
    expect(harness.showInformationMessage).not.toHaveBeenCalled()
  })

  it('resumes a paused break back to the break', async () => {
    timer.start('deep work')
    await vi.advanceTimersByTimeAsync(25 * 60 * 1000)
    timer.pause()
    const left = timer.getState().timeLeft
    toggle()
    expect(timer.getState()).toMatchObject({
      status: 'break',
      cycleType: 'break',
      timeLeft: left,
      currentTask: 'deep work',
    })
  })

  it('starts a full focus from stopped and keeps the cycle count', () => {
    timer.start('named')
    vi.advanceTimersByTime(8000)
    timer.stop()
    toggle()
    expect(timer.getState()).toMatchObject({
      status: 'running',
      cycleType: 'work',
      timeLeft: 25 * 60,
      currentTask: 'named',
      completedSessions: 0,
    })
  })

  it('reset from idle with an empty cycle does not ask', async () => {
    const reset = harness.commands.get('cut-a-while.reset')
    await reset?.()
    expect(harness.showWarningMessage).not.toHaveBeenCalled()
    expect(timer.getState().status).toBe('idle')
    expect(harness.showInformationMessage).not.toHaveBeenCalled()
  })

  it('reset asks with the cycle-counter copy and does nothing when dismissed', async () => {
    timer.start()
    await vi.advanceTimersByTimeAsync(25 * 60 * 1000)
    const before = timer.getState()
    harness.showWarningMessage.mockResolvedValueOnce(undefined)
    const reset = harness.commands.get('cut-a-while.reset')
    await reset?.()
    expect(harness.showWarningMessage).toHaveBeenCalledWith(
      'Cut a While: Reset the cycle counter to zero? Stats history is kept.',
      { modal: true },
      'Reset',
    )
    expect(timer.getState()).toEqual(before)
    expect(harness.showInformationMessage).not.toHaveBeenCalled()
  })

  it('reset clears the cycle only after confirmation', async () => {
    timer.start('named')
    await vi.advanceTimersByTimeAsync(25 * 60 * 1000)
    harness.showWarningMessage.mockResolvedValueOnce('Reset')
    const reset = harness.commands.get('cut-a-while.reset')
    await reset?.()
    expect(timer.getState()).toMatchObject({
      status: 'idle',
      completedSessions: 0,
      currentTask: '',
      timeLeft: 25 * 60,
    })
    expect(timer.getSessions()).toHaveLength(1)
    expect(harness.showInformationMessage).not.toHaveBeenCalled()
  })

  it('show panel and stats call the host commands', async () => {
    const openStats = vi.fn()
    commands.setPanel({ openStats } as never)
    harness.commands.get('cut-a-while.showPanel')?.()
    await harness.commands.get('cut-a-while.stats')?.()
    expect(harness.executeCommand).toHaveBeenNthCalledWith(1, 'cut-a-while.timerPanel.focus')
    expect(harness.executeCommand).toHaveBeenNthCalledWith(2, 'cut-a-while.timerPanel.focus')
    expect(openStats).toHaveBeenCalledTimes(1)
  })
})
