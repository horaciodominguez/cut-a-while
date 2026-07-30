import * as vscode from 'vscode';
import { TimerManager } from './timer/timerManager.js';
import { Notifications } from './notifications.js';

export class AutoPauseManager implements vscode.Disposable {
  private wasRunning = false;
  private disposable: vscode.Disposable;

  constructor(timer: TimerManager) {
    this.disposable = vscode.window.onDidChangeWindowState((state) => {
      if (!state.focused) {
        const ts = timer.getState();
        if (ts.status === 'running' || ts.status === 'break') {
          this.wasRunning = true;
          timer.pause();
        }
      } else if (this.wasRunning) {
        this.wasRunning = false;
        Notifications.confirm('Focus time paused while you were away. Resume?', 'Resume').then((action) => {
          if (action) timer.resume();
        });
      }
    });
  }

  dispose() {
    this.disposable.dispose();
  }
}
