import * as vscode from 'vscode';
import { TimerManager, type TimerState } from './timer/timerManager.js';

const STATE_ICONS: Record<string, string> = {
  idle: '$(watch)',
  running: '$(play-circle)',
  paused: '$(debug-pause)',
  break: '$(coffee)',
  stopped: '$(stop-circle)',
};

const STATE_COLORS: Record<string, string> = {
  idle: '',
  running: '#4fc3f7',
  paused: '#ffb74d',
  break: '#81c784',
  stopped: '#ef5350',
};

export class StatusBarManager implements vscode.Disposable {
  private item: vscode.StatusBarItem;
  private timer: TimerManager;
  private disposable: vscode.Disposable;

  constructor(timer: TimerManager) {
    this.timer = timer;
    this.item = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      100,
    );
    this.item.command = 'cut-a-while.showPanel';
    this.item.tooltip = 'Cut a While — Pomodoro Timer';
    this.item.text = '$(watch) 25:00';

    this.disposable = timer.onDidChangeState((state) => this.update(state));
  }

  init() {
    this.item.show();
    this.update(this.timer.getState());
  }

  private update(state: TimerState) {
    const timeFormatted = this.formatTime(state.timeLeft);
    const icon = STATE_ICONS[state.status] || '$(watch)';
    const color = STATE_COLORS[state.status] || '';

    this.item.text = `${icon} ${timeFormatted}`;
    this.item.backgroundColor = color ? new vscode.ThemeColor('statusBarItem.prominentBackground') : undefined;
    this.item.color = color || undefined;

    const sessions = state.completedSessions;
    const cycleLabel = state.cycleType === 'work' ? 'Focus' : 'Break';
    this.item.tooltip =
      `Cut a While — ${cycleLabel}\n` +
      `${timeFormatted} remaining\n` +
      `Completed: ${sessions} pomodoro${sessions !== 1 ? 's' : ''}\n` +
      `${sessions % 4 === 0 && sessions > 0 ? 'Long break upcoming!' : `${4 - (sessions % 4)} sessions until long break`}\n` +
      `---\nClick to open panel`;

    this.updateAlignment();
  }

  private updateAlignment() {
    const config = vscode.workspace.getConfiguration('cut-a-while');
    const align = config.get<string>('statusBarAlignment', 'right');
    if (align === 'left' && this.item.alignment !== vscode.StatusBarAlignment.Left) {
      this.item.dispose();
      this.item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
      this.item.command = 'cut-a-while.showPanel';
      this.item.show();
    }
  }

  private formatTime(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  dispose() {
    this.disposable.dispose();
    this.item.dispose();
  }
}
