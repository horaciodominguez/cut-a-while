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

  set<T>(key: string, value: T): void {
    this.globalState.update(`cut-a-while.${key}`, value);
  }

  getWorkspace<T>(key: string, defaultValue: T): T {
    return this.workspaceState.get<T>(`cut-a-while.${key}`, defaultValue);
  }

  setWorkspace<T>(key: string, value: T): void {
    this.workspaceState.update(`cut-a-while.${key}`, value);
  }

  pushToArray<T>(key: string, value: T): void {
    const arr = this.get<T[]>(key, []);
    arr.push(value);
    this.set(key, arr);
  }

  private migrate(): void {
    const version = this.get<number>('schemaVersion', 0);
    if (version < STORAGE_VERSION) {
      this.set('schemaVersion', STORAGE_VERSION);
    }
  }
}
