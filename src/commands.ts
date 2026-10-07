import * as vscode from 'vscode';
import { TimerManager } from './timer/timerManager.js';
import type { TimerPanelProvider } from './providers/TimerPanelProvider.js';

export class CommandsManager {
  private timer: TimerManager;
  private panel: TimerPanelProvider | undefined;

  constructor(timer: TimerManager, panel?: TimerPanelProvider) {
    this.timer = timer;
    this.panel = panel;
  }

  setPanel(panel: TimerPanelProvider) {
    this.panel = panel;
  }

  register(context: vscode.ExtensionContext) {
    const toggle = vscode.commands.registerCommand('cut-a-while.toggle', () => {
      const state = this.timer.getState();
      if (state.status === 'running' || state.status === 'break') {
        this.timer.pause();
      } else if (state.status === 'paused') {
        this.timer.resume();
      } else {
        this.timer.start();
      }
    });

    const showPanel = vscode.commands.registerCommand('cut-a-while.showPanel', () => {
      vscode.commands.executeCommand('cut-a-while.timerPanel.focus');
    });

    const reset = vscode.commands.registerCommand('cut-a-while.reset', async () => {
      const state = this.timer.getState();
      const needsConfirm =
        state.status === 'running' ||
        state.status === 'paused' ||
        state.status === 'break' ||
        state.status === 'stopped' ||
        state.completedSessions > 0;
      if (needsConfirm) {
        const action = await vscode.window.showWarningMessage(
          'Cut a While: Reset the cycle counter to zero? Stats history is kept.',
          { modal: true },
          'Reset',
        );
        if (action !== 'Reset') return;
      }
      this.timer.reset();
    });

    const stats = vscode.commands.registerCommand('cut-a-while.stats', async () => {
      await vscode.commands.executeCommand('cut-a-while.timerPanel.focus');
      this.panel?.openStats();
    });

    context.subscriptions.push(toggle, showPanel, reset, stats);
  }
}
