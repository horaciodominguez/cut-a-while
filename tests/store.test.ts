import { describe, it, expect, vi, beforeEach } from 'vitest'

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
  return { EventEmitter }
})

import type { ExtensionContext, Memento } from 'vscode'
import { StorageManager } from '../src/storage/store.js'

function mockMemento(initial?: Record<string, unknown>): Memento {
  const store: Record<string, unknown> = { ...initial }
  return {
    get: vi.fn(<T>(key: string, defaultValue?: T) => {
      return (key in store ? (store[key] as T) : defaultValue) as T
    }),
    update: vi.fn(async (key: string, value: unknown) => { store[key] = value }),
    keys: vi.fn().mockReturnValue([]),
    setKeysForSync: vi.fn(),
  }
}

function createMockContext(initialGlobal?: Record<string, unknown>): ExtensionContext {
  return {
    globalState: mockMemento(initialGlobal),
    workspaceState: mockMemento(),
    subscriptions: [],
    extensionUri: null as unknown as import('vscode').Uri,
    extensionPath: '',
    storagePath: '',
    globalStoragePath: '',
    logPath: '',
    logUri: null as unknown as import('vscode').Uri,
    storageUri: null as unknown as import('vscode').Uri,
    globalStorageUri: null as unknown as import('vscode').Uri,
    extensionMode: 1,
    environmentVariableCollection: null as unknown as import('vscode').EnvironmentVariableCollection,
    extension: null as unknown as import('vscode').Extension<unknown>,
    secrets: null as unknown as import('vscode').SecretStorage,
    asAbsolutePath: vi.fn(),
    workspaceStateKeys: vi.fn(),
    globalStateKeys: vi.fn(),
    setKeysForSync: vi.fn(),
  }
}

describe('StorageManager', () => {
  let storage: StorageManager
  let context: ExtensionContext

  beforeEach(() => {
    context = createMockContext()
    storage = new StorageManager(context)
  })

  it('stores and retrieves values with prefix', () => {
    storage.set('testKey', 'hello')
    expect(context.globalState.update).toHaveBeenCalledWith('cut-a-while.testKey', 'hello')
    expect(storage.get('testKey', 'default')).toBe('hello')
  })

  it('returns default when key not found', () => {
    expect(storage.get('nonexistent', 42)).toBe(42)
  })

  it('pushes to array', async () => {
    storage.set('list', ['a', 'b'])
    await storage.pushToArray('list', 'c')
    expect(storage.get('list', [])).toEqual(['a', 'b', 'c'])
  })

  it('creates array when key does not exist', async () => {
    await storage.pushToArray('newList', 'first')
    expect(storage.get('newList', [])).toEqual(['first'])
  })

  it('stores and retrieves workspace scoped values', () => {
    storage.setWorkspace('wsKey', 'workspace value')
    expect(context.workspaceState.update).toHaveBeenCalledWith('cut-a-while.wsKey', 'workspace value')
    expect(storage.getWorkspace('wsKey', 'default')).toBe('workspace value')
  })

  it('initializes schema version on first use', () => {
    expect(context.globalState.update).toHaveBeenCalledWith('cut-a-while.schemaVersion', 1)
  })

  it('does not re-run migration if schema is current', () => {
    context = createMockContext({ 'cut-a-while.schemaVersion': 1 })
    new StorageManager(context)
    expect(context.globalState.update).not.toHaveBeenCalledWith('cut-a-while.schemaVersion', 1)
  })

  it('returns workspace default when key not found', () => {
    expect(storage.getWorkspace('nonexistent', false)).toBe(false)
  })

  it('overwrites existing key', () => {
    storage.set('key', 'first')
    expect(storage.get('key', '')).toBe('first')
    storage.set('key', 'second')
    expect(storage.get('key', '')).toBe('second')
  })
})
