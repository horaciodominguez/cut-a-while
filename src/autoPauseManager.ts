import * as vscode from 'vscode';
import { TimerManager } from './timer/timerManager.js';
import { Notifications } from './notifications.js';

export class AutoPauseManager implements vscode.Disposable {
  private wasRunning = false;
  private awaitingResume = false;
  private disposable: vscode.Disposable;

  constructor(timer: TimerManager) {
    this.disposable = vscode.window.onDidChangeWindowState((state) => {
      const enabled = vscode.workspace
        .getConfiguration('cut-a-while')
        .get<boolean>('autoPause', true);
      if (!enabled) return;

      if (!state.focused) {
        const ts = timer.getState();
        if (ts.status === 'running' || ts.status === 'break') {
          this.wasRunning = true;
          timer.pause();
        }
      } else if (this.wasRunning && !this.awaitingResume) {
        const ts = timer.getState();
        if (ts.status !== 'paused') {
          this.wasRunning = false;
          return;
        }
        this.awaitingResume = true;
        const label = ts.cycleType === 'break' ? 'Break' : 'Focus time';
        Notifications.confirm(
          `${label} paused while you were away. Resume?`,
          'Resume',
        ).then((action) => {
          this.awaitingResume = false;
          if (action) {
            this.wasRunning = false;
            timer.resume();
          }
        });
      }
    });
  }

  dispose() {
    this.disposable.dispose();
  }
}
