import * as vscode from 'vscode';
import { TimerManager } from './timer/timerManager.js';
import { StorageManager } from './storage/store.js';

export class ProjectFocusTracker implements vscode.Disposable {
  private storage: StorageManager;
  private currentProject = '';
  private lastTimeLeft = 0;
  private wasRunning = false;

  constructor(timer: TimerManager, storage: StorageManager) {
    this.storage = storage;

    this.updateProject();
    timer.onDidChangeState((state) => {
      if (state.status === 'running') {
        if (this.wasRunning && this.currentProject && this.lastTimeLeft > 0) {
          const elapsed = this.lastTimeLeft - state.timeLeft;
          if (elapsed > 0) {
            this.accumulate(elapsed);
          }
        }
        this.lastTimeLeft = state.timeLeft;
        this.wasRunning = true;
      } else {
        this.lastTimeLeft = 0;
        this.wasRunning = false;
      }
    });
  }

  private updateProject() {
    const folder = vscode.workspace.workspaceFolders?.[0];
    this.currentProject = folder?.name ?? '';
  }

  private accumulate(seconds: number) {
    if (!this.currentProject) return;
    const data = this.storage.get<Record<string, number>>('projectFocus', {});
    data[this.currentProject] = (data[this.currentProject] || 0) + seconds;
    this.storage.set('projectFocus', data);
  }

  getProjectTime(project: string): number {
    const data = this.storage.get<Record<string, number>>('projectFocus', {});
    return data[project] || 0;
  }

  getAllProjectTimes(): Record<string, number> {
    return this.storage.get<Record<string, number>>('projectFocus', {});
  }

  dispose() {}
}
