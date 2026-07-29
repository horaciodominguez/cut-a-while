import * as vscode from 'vscode';
import { TimerManager } from './timer/timerManager.js';
import { Notifications } from './notifications.js';

export class CommandsManager {
  private timer: TimerManager;

  constructor(timer: TimerManager) {
    this.timer = timer;
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

    const reset = vscode.commands.registerCommand('cut-a-while.reset', () => {
      this.timer.reset();
      Notifications.info('Timer reset');
    });

    const stats = vscode.commands.registerCommand('cut-a-while.stats', () => {
      vscode.commands.executeCommand('cut-a-while.timerPanel.focus');
    });

    context.subscriptions.push(toggle, showPanel, reset, stats);
  }
}
