import * as vscode from 'vscode';

const STORAGE_VERSION = 1;

export class StorageManager {
  private globalState: vscode.Memento;
  private workspaceState: vscode.Memento;
  /** Per-key write chains — prevents lost updates from concurrent read-modify-write. */
  private writeQueues = new Map<string, Promise<void>>();

  constructor(context: vscode.ExtensionContext) {
    this.globalState = context.globalState;
    this.workspaceState = context.workspaceState;
    this.migrate();
  }

  get<T>(key: string, defaultValue: T): T {
    return this.globalState.get<T>(`cut-a-while.${key}`, defaultValue);
  }

  async set<T>(key: string, value: T): Promise<void> {
    return this.enqueue(`global:${key}`, async () => {
      await this.globalState.update(`cut-a-while.${key}`, value);
    });
  }

  getWorkspace<T>(key: string, defaultValue: T): T {
    return this.workspaceState.get<T>(`cut-a-while.${key}`, defaultValue);
  }

  async setWorkspace<T>(key: string, value: T): Promise<void> {
    return this.enqueue(`workspace:${key}`, async () => {
      await this.workspaceState.update(`cut-a-while.${key}`, value);
    });
  }

  async pushToArray<T>(key: string, value: T): Promise<void> {
    // Must run read-modify-write inside the same queue slot (do not call set() — nested enqueue deadlocks).
    return this.enqueue(`global:${key}`, async () => {
      const arr = this.get<T[]>(key, []);
      arr.push(value);
      await this.globalState.update(`cut-a-while.${key}`, arr);
    });
  }

  private enqueue(queueKey: string, op: () => Promise<void>): Promise<void> {
    const prev = this.writeQueues.get(queueKey) ?? Promise.resolve();
    const next = prev.then(op, op);
    this.writeQueues.set(
      queueKey,
      next.finally(() => {
        if (this.writeQueues.get(queueKey) === next) {
          this.writeQueues.delete(queueKey);
        }
      }),
    );
    return next;
  }

  private async migrate(): Promise<void> {
    const version = this.get<number>('schemaVersion', 0);
    if (version < STORAGE_VERSION) {
      await this.set('schemaVersion', STORAGE_VERSION);
    }
  }
}
