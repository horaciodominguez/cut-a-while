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

const GLOW_INTERVAL_MS = 2500;
const PRIORITY = 100;

export class StatusBarManager implements vscode.Disposable {
  private item: vscode.StatusBarItem;
  private timer: TimerManager;
  private stateDisposable: vscode.Disposable;
  private configDisposable: vscode.Disposable;
  private currentAlignment: string = 'right';
  private glowInterval: ReturnType<typeof setInterval> | null = null;
  private glowPhase = false;

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
    this.item.backgroundColor = color
      ? new vscode.ThemeColor('statusBarItem.prominentBackground')
      : undefined;

    const sessions = state.completedSessions;
    const cycleLabel = state.cycleType === 'work' ? 'Focus' : 'Break';
    const longBreakInterval = vscode.workspace.getConfiguration('cut-a-while').get<number>('longBreakInterval', 4);
    const nextLongBreak = sessions > 0 && sessions % longBreakInterval === 0
      ? 'Long break now!'
      : `${longBreakInterval - (sessions % longBreakInterval)} sessions until long break`;

    this.item.tooltip =
      `Cut a While — ${cycleLabel}\n` +
      `${timeFormatted} remaining\n` +
      `Completed: ${sessions} pomodoro${sessions !== 1 ? 's' : ''}\n` +
      `${nextLongBreak}\n` +
      `---\nClick to open panel`;

    if (state.status === 'running') {
      this.startGlow();
    } else {
      this.stopGlow();
    }
  }

  private startGlow() {
    if (this.glowInterval) return;
    this.glowPhase = false;

    this.glowInterval = setInterval(() => {
      this.glowPhase = !this.glowPhase;
      this.item.backgroundColor = this.glowPhase
        ? new vscode.ThemeColor('statusBarItem.prominentBackground')
        : undefined;
    }, GLOW_INTERVAL_MS);
  }

  private stopGlow() {
    if (this.glowInterval) {
      clearInterval(this.glowInterval);
      this.glowInterval = null;
    }
    this.item.backgroundColor = undefined;
  }

  private formatTime(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  dispose() {
    this.stopGlow();
    this.stateDisposable.dispose();
    this.configDisposable.dispose();
    this.item.dispose();
  }
}
