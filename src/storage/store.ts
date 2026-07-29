import * as vscode from 'vscode';

const STORAGE_VERSION = 1;

export class StorageManager {
  private globalState: vscode.Memento;
  private workspaceState: vscode.Memento;

  constructor(context: vscode.ExtensionContext) {
    this.globalState = context.globalState;
    this.workspaceState = context.workspaceState;
    this.migrate();
  }

  get<T>(key: string, defaultValue: T): T {
    return this.globalState.get<T>(`cut-a-while.${key}`, defaultValue);
  }

  async set<T>(key: string, value: T): Promise<void> {
    await this.globalState.update(`cut-a-while.${key}`, value);
  }

  getWorkspace<T>(key: string, defaultValue: T): T {
    return this.workspaceState.get<T>(`cut-a-while.${key}`, defaultValue);
  }

  async setWorkspace<T>(key: string, value: T): Promise<void> {
    await this.workspaceState.update(`cut-a-while.${key}`, value);
  }

  async pushToArray<T>(key: string, value: T): Promise<void> {
    const arr = this.get<T[]>(key, []);
    arr.push(value);
    await this.set(key, arr);
  }

  private async migrate(): Promise<void> {
    const version = this.get<number>('schemaVersion', 0);
    if (version < STORAGE_VERSION) {
      await this.set('schemaVersion', STORAGE_VERSION);
    }
  }
}
