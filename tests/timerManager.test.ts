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

  it('pauses a break and resumes back to break', async () => {
    timer.start()
    await vi.advanceTimersByTimeAsync(25 * 60 * 1000)
    expect(timer.getState().status).toBe('break')

    timer.pause()
    expect(timer.getState().status).toBe('paused')
    expect(timer.getState().cycleType).toBe('break')

    timer.resume()
    expect(timer.getState().status).toBe('break')
    expect(timer.getState().cycleType).toBe('break')
  })

  it('ignores reset while completion is in flight', async () => {
    let release!: () => void
    storage.pushToArray.mockImplementationOnce(
      () => new Promise<void>((resolve) => { release = resolve }),
    )

    timer.start()
    vi.advanceTimersByTime(25 * 60 * 1000)
    await Promise.resolve()
    await Promise.resolve()

    expect(timer.getState().status).toBe('running')
    timer.reset()
    expect(timer.getState().status).toBe('running')
    expect(timer.getState().completedSessions).toBe(0)

    release()
    for (let i = 0; i < 20; i++) await Promise.resolve()
    expect(timer.getState().status).toBe('break')
    expect(timer.getState().completedSessions).toBe(1)
  })

  it('restores an expired work cycle as a completed session then break', () => {
    timer.dispose()
    const savedAt = Date.now() - 120_000
    void storage.set('timerState', {
      status: 'running',
      timeLeft: 60,
      totalTime: 25 * 60,
      cycleType: 'work',
      completedSessions: 0,
      currentTask: 'late session',
      savedAt,
    })

    const restored = new TimerManager(storage as unknown as Memento)
    const state = restored.getState()
    expect(state.status).toBe('break')
    expect(state.cycleType).toBe('break')
    expect(state.completedSessions).toBe(1)
    expect(state.currentTask).toBe('late session')
    expect(storage.pushToArray).toHaveBeenCalledWith(
      'sessions',
      expect.objectContaining({ type: 'work', task: 'late session' }),
    )
    restored.dispose()
  })

  it('restores an expired break to idle when autoStart is false', () => {
    timer.dispose()
    configStore.autoStart = false
    void storage.set('timerState', {
      status: 'break',
      timeLeft: 30,
      totalTime: 5 * 60,
      cycleType: 'break',
      completedSessions: 2,
      currentTask: '',
      savedAt: Date.now() - 120_000,
    })

    const restored = new TimerManager(storage as unknown as Memento)
    expect(restored.getState().status).toBe('idle')
    expect(restored.getState().cycleType).toBe('work')
    expect(restored.getState().completedSessions).toBe(2)
    expect(storage.pushToArray).toHaveBeenCalledWith(
      'sessions',
      expect.objectContaining({ type: 'break' }),
    )
    restored.dispose()
  })

  it('restores a mid-cycle running timer with remaining time', () => {
    timer.dispose()
    void storage.set('timerState', {
      status: 'running',
      timeLeft: 100,
      totalTime: 25 * 60,
      cycleType: 'work',
      completedSessions: 1,
      currentTask: 'still going',
      savedAt: Date.now() - 10_000,
    })

    const restored = new TimerManager(storage as unknown as Memento)
    expect(restored.getState().status).toBe('running')
    expect(restored.getState().cycleType).toBe('work')
    expect(restored.getState().timeLeft).toBe(90)
    expect(restored.getState().currentTask).toBe('still going')
    expect(storage.pushToArray).not.toHaveBeenCalled()
    restored.dispose()
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

  it('drops every elapsed second when a tick arrives late', () => {
    timer.start()
    const before = timer.getState().timeLeft
    const startedAt = Date.now()
    vi.setSystemTime(startedAt + 10_000)
    vi.advanceTimersToNextTimer()
    const elapsed = Math.floor((Date.now() - startedAt) / 1000)
    expect(elapsed).toBe(11)
    expect(timer.getState().timeLeft).toBe(before - 11)
  })

  it('transitions to break when work completes', async () => {
    timer.start('test task')
    await vi.advanceTimersByTimeAsync(25 * 60 * 1000)
    const state = timer.getState()
    expect(state.status).toBe('break')
    expect(state.cycleType).toBe('break')
    expect(state.timeLeft).toBe(5 * 60)
    expect(state.completedSessions).toBe(1)
    expect(state.currentTask).toBe('test task')
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

  it('skipBreak transitions from break to running work and keeps the task', async () => {
    timer.start('deep work')
    await vi.advanceTimersByTimeAsync(25 * 60 * 1000)
    timer.skipBreak()
    const state = timer.getState()
    expect(state.status).toBe('running')
    expect(state.cycleType).toBe('work')
    expect(state.timeLeft).toBe(25 * 60)
    expect(state.currentTask).toBe('deep work')
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

  it('stores session duration as totalTime, not hardcoded workDuration', async () => {
    timer.start('dur test')
    await vi.advanceTimersByTimeAsync(25 * 60 * 1000)
    expect(storage.pushToArray).toHaveBeenCalledWith('sessions', expect.objectContaining({
      type: 'work',
      duration: 25 * 60,
      task: 'dur test',
    }))
  })

  it('increments completedSessions only on work completion, not break', async () => {
    configStore.autoStart = false
    timer.start()
    await vi.advanceTimersByTimeAsync(25 * 60 * 1000)
    expect(timer.getState().completedSessions).toBe(1)

    // complete the break
    await vi.advanceTimersByTimeAsync(5 * 60 * 1000)
    // completedSessions should still be 1 (not incremented during break)
    expect(timer.getState().completedSessions).toBe(1)
  })

  it('sets status to idle when break completes with autoStart=false', async () => {
    configStore.autoStart = false
    timer.start()
    await vi.advanceTimersByTimeAsync(25 * 60 * 1000)
    expect(timer.getState().status).toBe('break')

    await vi.advanceTimersByTimeAsync(5 * 60 * 1000)
    expect(timer.getState().status).toBe('idle')
    expect(timer.getState().cycleType).toBe('work')
  })

  it('getSessions returns stored sessions', async () => {
    expect(timer.getSessions()).toEqual([])

    timer.start()
    await vi.advanceTimersByTimeAsync(25 * 60 * 1000)
    const sessions = timer.getSessions()
    expect(sessions).toHaveLength(1)
    expect(sessions[0].type).toBe('work')
    expect(sessions[0].duration).toBe(25 * 60)
  })

  it('does not tick on start before 1 second', () => {
    timer.start()
    // timeLeft should still be the full duration (no immediate decrement)
    expect(timer.getState().timeLeft).toBe(25 * 60)
  })

  it('keeps the task through the break and the auto-started focus', async () => {
    timer.start('deep work')
    await vi.advanceTimersByTimeAsync(25 * 60 * 1000)
    expect(timer.getState()).toMatchObject({
      status: 'break',
      cycleType: 'break',
      timeLeft: 5 * 60,
      completedSessions: 1,
      currentTask: 'deep work',
    })

    await vi.advanceTimersByTimeAsync(5 * 60 * 1000)
    expect(timer.getState()).toMatchObject({
      status: 'running',
      cycleType: 'work',
      timeLeft: 25 * 60,
      totalTime: 25 * 60,
      completedSessions: 1,
      currentTask: 'deep work',
    })
  })

  it('stop keeps the cycle count and the task, and the next start is a full focus', async () => {
    timer.start('named')
    await vi.advanceTimersByTimeAsync(25 * 60 * 1000)
    timer.stop()
    expect(timer.getState()).toMatchObject({
      status: 'stopped',
      cycleType: 'break',
      timeLeft: 5 * 60,
      completedSessions: 1,
      currentTask: 'named',
    })

    timer.start()
    expect(timer.getState()).toMatchObject({
      status: 'running',
      cycleType: 'work',
      timeLeft: 25 * 60,
      totalTime: 25 * 60,
      completedSessions: 1,
      currentTask: 'named',
    })
  })

  it('reset clears the cycle counter and keeps saved sessions', async () => {
    timer.start('kept in stats')
    await vi.advanceTimersByTimeAsync(25 * 60 * 1000)
    const sessions = timer.getSessions()
    expect(sessions).toEqual([
      expect.objectContaining({ type: 'work', duration: 25 * 60, task: 'kept in stats' }),
    ])

    timer.reset()
    expect(timer.getState()).toMatchObject({
      status: 'idle',
      timeLeft: 25 * 60,
      completedSessions: 0,
      currentTask: '',
    })
    expect(timer.getSessions()).toEqual(sessions)
  })

  it('skipBreak does nothing unless a break is running', () => {
    timer.start('stay')
    const before = timer.getState()
    timer.skipBreak()
    expect(timer.getState()).toEqual(before)
  })

  it('pause during a break keeps the remaining time and the task', async () => {
    timer.start('reading')
    await vi.advanceTimersByTimeAsync(25 * 60 * 1000)
    vi.advanceTimersByTime(2000)
    const left = timer.getState().timeLeft
    expect(left).toBe(5 * 60 - 2)

    timer.pause()
    vi.advanceTimersByTime(10_000)
    expect(timer.getState()).toMatchObject({
      status: 'paused',
      cycleType: 'break',
      timeLeft: left,
      currentTask: 'reading',
    })

    timer.resume()
    expect(timer.getState().status).toBe('break')
    expect(timer.getState().timeLeft).toBe(left)
  })

  it('reaches a long break only on the fourth focus and keeps the task', async () => {
    configStore.workDuration = 1 / 60
    configStore.breakDuration = 1 / 60
    configStore.longBreakDuration = 2 / 60
    configStore.longBreakInterval = 4
    configStore.autoStart = true
    const cycle = new TimerManager(storage as unknown as Memento)
    cycle.start('cycle')

    for (let i = 0; i < 3; i++) {
      await vi.advanceTimersByTimeAsync(1000)
      expect(cycle.getState()).toMatchObject({
        status: 'break',
        timeLeft: 1,
        completedSessions: i + 1,
        currentTask: 'cycle',
      })
      await vi.advanceTimersByTimeAsync(1000)
      expect(cycle.getState()).toMatchObject({
        status: 'running',
        cycleType: 'work',
        timeLeft: 1,
        currentTask: 'cycle',
      })
    }

    await vi.advanceTimersByTimeAsync(1000)
    expect(cycle.getState()).toMatchObject({
      status: 'break',
      cycleType: 'break',
      timeLeft: 2,
      totalTime: 2,
      completedSessions: 4,
      currentTask: 'cycle',
    })
    expect(cycle.getSessions().map((session) => session.type)).toEqual([
      'work', 'break', 'work', 'break', 'work', 'break', 'work',
    ])
    cycle.dispose()
  })

  it('handles start from stopped state', () => {
    timer.start()
    vi.advanceTimersByTime(5000)
    timer.stop()
    expect(timer.getState().status).toBe('stopped')

    timer.start()
    expect(timer.getState().status).toBe('running')
    expect(timer.getState().timeLeft).toBe(25 * 60)
  })

  describe('todos', () => {
    it('getTodos returns empty array initially', () => {
      expect(timer.getTodos()).toEqual([])
    })

    it('addTodo creates a todo item', async () => {
      const todo = await timer.addTodo('Refactor auth')
      expect(todo.text).toBe('Refactor auth')
      expect(todo.done).toBe(false)
      expect(todo.id.startsWith(`${Date.now()}-`)).toBe(true)
      expect(todo.createdAt).toBe(Date.now())
      expect(todo.completedAt).toBeUndefined()
    })

    it('addTodo stores the todo and getTodos returns it', async () => {
      await timer.addTodo('Write tests')
      const todos = timer.getTodos()
      expect(todos).toHaveLength(1)
      expect(todos[0].text).toBe('Write tests')
      expect(todos[0].done).toBe(false)
    })

    it('addTodo appends multiple todos', async () => {
      await timer.addTodo('Task A')
      await timer.addTodo('Task B')
      expect(timer.getTodos()).toHaveLength(2)
    })

    it('toggleTodo marks a pending todo as done and sets completedAt', async () => {
      const todo = await timer.addTodo('Fix bug')
      expect(todo.done).toBe(false)
      expect(todo.completedAt).toBeUndefined()

      await timer.toggleTodo(todo.id)
      const todos = timer.getTodos()
      const toggled = todos.find((t) => t.id === todo.id)
      expect(toggled).toBeDefined()
      expect(toggled!.done).toBe(true)
      expect(toggled!.completedAt).toBe(Date.now())
    })

    it('toggleTodo marks a done todo as pending and clears completedAt', async () => {
      const todo = await timer.addTodo('Done task')
      await timer.toggleTodo(todo.id)
      await timer.toggleTodo(todo.id)

      const todos = timer.getTodos()
      const toggled = todos.find((t) => t.id === todo.id)
      expect(toggled!.done).toBe(false)
      expect(toggled!.completedAt).toBeUndefined()
    })

    it('toggleTodo does nothing for unknown id', async () => {
      const before = timer.getTodos()
      await timer.toggleTodo('nonexistent')
      expect(timer.getTodos()).toEqual(before)
    })

    it('deleteTodo removes a todo', async () => {
      const todo = await timer.addTodo('To delete')
      expect(timer.getTodos()).toHaveLength(1)

      await timer.deleteTodo(todo.id)
      expect(timer.getTodos()).toHaveLength(0)
    })

    it('deleteTodo only removes the specified todo', async () => {
      const a = await timer.addTodo('Keep me')
      await timer.addTodo('Remove me')
      const c = await timer.addTodo('Keep me too')

      const removed = timer.getTodos().find((t) => t.text === 'Remove me')!
      await timer.deleteTodo(removed.id)

      const remaining = timer.getTodos()
      expect(remaining).toHaveLength(2)
      expect(remaining.find((t) => t.id === a.id)).toBeDefined()
      expect(remaining.find((t) => t.id === c.id)).toBeDefined()
    })

    it('deleteTodo does nothing for unknown id', async () => {
      await timer.addTodo('Some task')
      const before = timer.getTodos()
      await timer.deleteTodo('nonexistent')
      expect(timer.getTodos()).toEqual(before)
    })

    it('todos are persisted via storage', async () => {
      await timer.addTodo('Persist check')
      expect(storage.set).toHaveBeenCalledWith('todos', expect.arrayContaining([
        expect.objectContaining({ text: 'Persist check' }),
      ]))
    })
  })
})
