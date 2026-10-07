import * as vscode from 'vscode';
import { isLongBreakPhase, sessionsUntilLongBreak } from './core/utils/time.js';
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

const PRIORITY = 100;

export class StatusBarManager implements vscode.Disposable {
  private item: vscode.StatusBarItem;
  private timer: TimerManager;
  private stateDisposable: vscode.Disposable;
  private configDisposable: vscode.Disposable;
  private currentAlignment: string = 'right';

  constructor(timer: TimerManager) {
    this.timer = timer;
    this.item = this.createItem(vscode.StatusBarAlignment.Right);
    this.stateDisposable = timer.onDidChangeState((state) => this.update(state));

    this.configDisposable = vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('cut-a-while.statusBarAlignment')) {
        this.applyAlignment();
      }
    });
  }

  init() {
    this.item.show();
    this.update(this.timer.getState());
  }

  private createItem(alignment: vscode.StatusBarAlignment): vscode.StatusBarItem {
    const item = vscode.window.createStatusBarItem(alignment, PRIORITY);
    item.command = 'cut-a-while.showPanel';
    item.text = '$(watch) 00:00';
    item.tooltip = 'Cut a While — Pomodoro Timer';
    return item;
  }

  private applyAlignment() {
    const config = vscode.workspace.getConfiguration('cut-a-while');
    const align = config.get<string>('statusBarAlignment', 'right');
    if (align === this.currentAlignment) return;

    this.currentAlignment = align;
    const alignment = align === 'left'
      ? vscode.StatusBarAlignment.Left
      : vscode.StatusBarAlignment.Right;

    this.item.dispose();
    this.item = this.createItem(alignment);
    this.item.show();
    this.update(this.timer.getState());
  }

  private update(state: TimerState) {
    const timeFormatted = this.formatTime(state.timeLeft);
    const icon = STATE_ICONS[state.status] || '$(watch)';
    const color = STATE_COLORS[state.status] || '';

    this.item.text = `${icon} ${timeFormatted}`;
    this.item.color = color || undefined;
    this.item.backgroundColor = state.status === 'running'
      ? new vscode.ThemeColor('statusBarItem.prominentBackground')
      : undefined;

    const sessions = state.completedSessions;
    const interval = vscode.workspace.getConfiguration('cut-a-while').get<number>('longBreakInterval', 4);
    const longBreak = isLongBreakPhase(sessions, interval, state.cycleType);
    const cycleLabel = longBreak ? 'Long break' : state.cycleType === 'work' ? 'Focus' : 'Break';
    const untilLongBreak = longBreak
      ? 'Long break'
      : `${sessionsUntilLongBreak(sessions, interval)} until long break`;

    this.item.tooltip =
      `Cut a While — ${cycleLabel}\n` +
      `${timeFormatted} remaining\n` +
      `This cycle: ${sessions}\n` +
      `${untilLongBreak}\n` +
      `---\nClick to open panel`;
  }

  private formatTime(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  dispose() {
    this.stateDisposable.dispose();
    this.configDisposable.dispose();
    this.item.dispose();
  }
}
