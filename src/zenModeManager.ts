import * as vscode from 'vscode';
import { TimerManager, type TimerState } from './timer/timerManager.js';

export class ZenModeManager implements vscode.Disposable {
  private activatedByExtension = false;
  private busy = false;
  private disposable: vscode.Disposable;
  private readonly timer: TimerManager;

  constructor(timer: TimerManager) {
    this.timer = timer;
    this.disposable = timer.onDidChangeState((state) => {
      void this.sync(state);
    });
  }

  private shouldBeInZen(state: TimerState): boolean {
    const enabled = vscode.workspace
      .getConfiguration('cut-a-while')
      .get<boolean>('zenMode', false);
    return enabled && state.cycleType === 'work' && state.status === 'running';
  }

  private async sync(state: TimerState): Promise<void> {
    if (this.busy) return;

    if (this.shouldBeInZen(state)) {
      if (!this.activatedByExtension) {
        await this.enterZen();
      }
      return;
    }

    if (this.activatedByExtension) {
      await this.exitZen();
    }
  }

  /**
   * Enter Zen safely: normalize with exitZenMode (no-op if already out), then toggle in.
   * Avoids blind toggle that would leave Zen if the user was already in it.
   */
  private async enterZen(): Promise<void> {
    if (this.activatedByExtension || this.busy) return;
    this.busy = true;
    try {
      await vscode.commands.executeCommand('workbench.action.exitZenMode');
      await vscode.commands.executeCommand('workbench.action.toggleZenMode');
      this.activatedByExtension = true;
    } catch {
      this.activatedByExtension = false;
    } finally {
      this.busy = false;
      // State may have changed while commands were in flight
      if (!this.shouldBeInZen(this.timer.getState()) && this.activatedByExtension) {
        await this.exitZen();
      }
    }
  }

  /**
   * Exit with exitZenMode (idempotent) so a manual user exit cannot be toggled back on.
   */
  private async exitZen(): Promise<void> {
    if (!this.activatedByExtension || this.busy) return;
    this.busy = true;
    this.activatedByExtension = false;
    try {
      await vscode.commands.executeCommand('workbench.action.exitZenMode');
    } catch {
      // ignore
    } finally {
      this.busy = false;
      if (this.shouldBeInZen(this.timer.getState()) && !this.activatedByExtension) {
        await this.enterZen();
      }
    }
  }

  dispose() {
    if (this.activatedByExtension) {
      this.activatedByExtension = false;
      void vscode.commands.executeCommand('workbench.action.exitZenMode');
    }
    this.disposable.dispose();
  }
}
