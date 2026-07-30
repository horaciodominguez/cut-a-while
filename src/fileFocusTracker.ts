import * as vscode from 'vscode';
import { TimerManager } from './timer/timerManager.js';
import { StorageManager } from './storage/store.js';

export class FileFocusTracker implements vscode.Disposable {
  private storage: StorageManager;
  private currentFile: string | null = null;
  private lastTimeLeft = 0;
  private wasRunning = false;
  private subscriptions: vscode.Disposable[] = [];

  constructor(timer: TimerManager, storage: StorageManager) {
    this.storage = storage;

    this.subscriptions.push(
      vscode.window.onDidChangeActiveTextEditor((e) => {
        this.currentFile = e?.document.uri.toString() ?? null;
      }),
    );

    this.subscriptions.push(
      timer.onDidChangeState((state) => {
        if (state.status === 'running') {
          if (this.wasRunning && this.currentFile && this.lastTimeLeft > 0) {
            const elapsed = this.lastTimeLeft - state.timeLeft;
            if (elapsed > 0) {
              this.accumulate(this.currentFile, elapsed);
            }
          }
          this.lastTimeLeft = state.timeLeft;
          this.wasRunning = true;
        } else {
          this.lastTimeLeft = 0;
          this.wasRunning = false;
        }
      }),
    );

    this.subscriptions.push(
      vscode.languages.registerHoverProvider({ scheme: 'file' }, {
        provideHover: (document) => {
          const seconds = this.getFocusTime(document.uri.toString());
          if (seconds <= 0) return null;
          return new vscode.Hover(`$(clock) Focus time: **${this.formatDuration(seconds)}**`);
        },
      }),
    );
  }

  private accumulate(uri: string, seconds: number) {
    const data = this.storage.getWorkspace<Record<string, number>>('fileFocus', {});
    data[uri] = (data[uri] || 0) + seconds;
    this.storage.setWorkspace('fileFocus', data);
  }

  getFocusTime(uri: string): number {
    const data = this.storage.getWorkspace<Record<string, number>>('fileFocus', {});
    return data[uri] || 0;
  }

  private formatDuration(seconds: number): string {
    const totalMinutes = Math.round(seconds / 60);
    if (totalMinutes < 60) {
      return `${totalMinutes} min`;
    }
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    return mins > 0 ? `${hours}h ${mins}min` : `${hours}h`;
  }

  dispose() {
    this.subscriptions.forEach((d) => d.dispose());
  }
}
