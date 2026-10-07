import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

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

  class TreeItem {
    label: string
    collapsibleState: number
    description?: string
    iconPath?: { id: string }
    command?: { command: string; title: string }
    constructor(label: string, collapsibleState: number) {
      this.label = label
      this.collapsibleState = collapsibleState
    }
  }

  class ThemeIcon {
    constructor(public id: string) {}
  }

  return {
    EventEmitter,
    TreeItem,
    ThemeIcon,
    TreeItemCollapsibleState: { None: 0, Collapsed: 1, Expanded: 2 },
    workspace: {
      getConfiguration: () => ({
        get: (_key: string, defaultValue?: unknown) => defaultValue,
      }),
    },
  }
})

import type { Memento } from 'vscode'
import { TimerTreeProvider } from '../src/treeView/TimerTreeProvider.js'
import { TimerManager } from '../src/timer/timerManager.js'
import type { Session } from '../src/timer/timerManager.js'

interface TreeNode {
  label: string
  description?: string
  command?: { command: string }
  children?: TreeNode[]
}

function createStorage(sessions: Session[] = []) {
  const store: Record<string, unknown> = { sessions }
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

describe('TimerTreeProvider', () => {
  let timer: TimerManager
  let provider: TimerTreeProvider

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 9, 6, 12, 0, 0))
  })

  afterEach(() => {
    provider?.dispose()
    timer?.dispose()
    vi.useRealTimers()
  })

  function mount(sessions: Session[] = []) {
    timer = new TimerManager(createStorage(sessions) as unknown as Memento)
    provider = new TimerTreeProvider(timer, createStorage(sessions) as never)
  }

  async function flatLabels(): Promise<string[]> {
    const roots = await provider.getChildren() as TreeNode[]
    const labels: string[] = []
    for (const root of roots) {
      labels.push(root.label)
      const children = await provider.getChildren(root as never) as TreeNode[]
      for (const child of children) labels.push(`${root.label}/${child.label}`)
    }
    return labels
  }

  it('lists open, today, and streak, and does not repeat the clock', async () => {
    const yesterday = new Date(2026, 9, 5, 18, 0, 0).getTime()
    const today = new Date(2026, 9, 6, 9, 0, 0).getTime()
    mount([
      { timestamp: yesterday, type: 'work', duration: 25 * 60, task: 'yesterday' },
      { timestamp: today, type: 'work', duration: 10 * 60, task: 'today' },
      { timestamp: today, type: 'break', duration: 5 * 60, task: '' },
    ])

    const roots = await provider.getChildren() as TreeNode[]
    expect(roots.map((item) => item.label)).toEqual(['Open Timer Panel', 'Today', 'Streak'])
    expect(roots[0].command?.command).toBe('cut-a-while.showPanel')
    expect(roots[0].description).toBe('The timer UI is the bottom panel')

    const todayChildren = await provider.getChildren(roots[1] as never) as TreeNode[]
    expect(todayChildren.map((item) => [item.label, item.description])).toEqual([
      ['Pomodoros', '1'],
      ['Focus Time', '10 min'],
    ])

    const streakChildren = await provider.getChildren(roots[2] as never) as TreeNode[]
    expect(streakChildren.map((item) => item.label)).toEqual(['Current'])

    const labels = await flatLabels()
    expect(labels).not.toContain('Status')
    expect(labels).not.toContain('Time Left')
    expect(labels).not.toContain('Cycle')
    expect(labels.join(' ')).not.toContain('Session count')
    expect(labels.join(' ')).not.toMatch(/Skip break|Start|Pause/)
  })

  it('rebuilds when the phase changes and ignores countdown ticks', () => {
    mount()
    const fires: unknown[] = []
    provider.onDidChangeTreeData((item) => { fires.push(item) })

    timer.start()
    expect(fires).toEqual([undefined])

    vi.advanceTimersByTime(5000)
    expect(fires).toEqual([undefined])

    timer.pause()
    expect(fires).toEqual([undefined, undefined])

    vi.advanceTimersByTime(5000)
    expect(fires).toHaveLength(2)
  })
})
