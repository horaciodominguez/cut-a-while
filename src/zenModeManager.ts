import * as vscode from 'vscode';
import { TimerManager } from './timer/timerManager.js';

export class ZenModeManager implements vscode.Disposable {
  private activatedByExtension = false;
  private disposable: vscode.Disposable;

  constructor(timer: TimerManager) {
    this.disposable = timer.onDidChangeState((state) => {
      const config = vscode.workspace.getConfiguration('cut-a-while');
      const enabled = config.get<boolean>('zenMode', false);

      const shouldBeInZen =
        enabled && state.cycleType === 'work' && state.status === 'running';

      if (shouldBeInZen) {
        if (!this.activatedByExtension) {
          void this.enterZen();
        }
        return;
      }

      // Pause, break, idle, stopped, or setting off → leave Zen if we entered it
      if (this.activatedByExtension) {
        void this.exitZen();
      }
    });
  }

  private async enterZen(): Promise<void> {
    try {
      await vscode.commands.executeCommand('workbench.action.toggleZenMode');
      this.activatedByExtension = true;
    } catch {
      this.activatedByExtension = false;
    }
  }

  private async exitZen(): Promise<void> {
    try {
      await vscode.commands.executeCommand('workbench.action.toggleZenMode');
    } catch {
      // ignore
    } finally {
      this.activatedByExtension = false;
    }
  }

  dispose() {
    if (this.activatedByExtension) {
      void this.exitZen();
    }
    this.disposable.dispose();
  }
}
