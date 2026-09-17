import * as vscode from 'vscode';
import { TimerManager } from './timer/timerManager.js';
import { Notifications } from './notifications.js';
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
      if (state.status === 'running') {
        this.timer.pause();
        Notifications.info('Timer paused');
      } else if (state.status === 'paused' || state.status === 'idle') {
        this.timer.start();
        Notifications.info('Focus time!');
      } else if (state.status === 'break') {
        this.timer.skipBreak();
        Notifications.info('Break skipped');
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
        state.completedSessions > 0;
      if (needsConfirm) {
        const action = await vscode.window.showWarningMessage(
          'Cut a While: Reset timer and clear session progress for this cycle?',
          { modal: true },
          'Reset',
        );
        if (action !== 'Reset') return;
      }
      this.timer.reset();
      Notifications.info('Timer reset');
    });

    const stats = vscode.commands.registerCommand('cut-a-while.stats', async () => {
      await vscode.commands.executeCommand('cut-a-while.timerPanel.focus');
      this.panel?.openStats();
    });

    context.subscriptions.push(toggle, showPanel, reset, stats);
  }
}
