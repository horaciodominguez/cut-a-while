import * as vscode from 'vscode';
import { TimerManager } from './timer/timerManager.js';

export class ZenModeManager implements vscode.Disposable {
  private activatedByExtension = false;
  private disposable: vscode.Disposable;

  constructor(timer: TimerManager) {
    this.disposable = timer.onDidChangeState((state) => {
      const config = vscode.workspace.getConfiguration('cut-a-while');
      const enabled = config.get<boolean>('zenMode', false);
      if (!enabled) return;

      if (state.cycleType === 'work' && state.status === 'running') {
        if (!this.activatedByExtension) {
          vscode.commands.executeCommand('workbench.action.toggleZenMode');
          this.activatedByExtension = true;
        }
      } else if (state.status === 'idle' || state.status === 'stopped') {
        if (this.activatedByExtension) {
          vscode.commands.executeCommand('workbench.action.toggleZenMode');
          this.activatedByExtension = false;
        }
      }
    });
  }

  dispose() {
    this.disposable.dispose();
  }
}
