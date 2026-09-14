import * as vscode from 'vscode';
import { calcStreak } from '../core/utils/streak.js';
import { TimerManager, type Session } from '../timer/timerManager.js';
import { StorageManager } from '../storage/store.js';

class TimerTreeItem extends vscode.TreeItem {
  children: TimerTreeItem[] | undefined;

  constructor(
    label: string,
    collapsibleState: vscode.TreeItemCollapsibleState,
    description?: string,
    icon?: string,
    command?: vscode.Command,
    children?: TimerTreeItem[],
  ) {
    super(label, collapsibleState);
    this.description = description;
    this.children = children;
    if (icon) {
      this.iconPath = new vscode.ThemeIcon(icon);
    }
    if (command) {
      this.command = command;
    }
  }
}

function isToday(ts: number): boolean {
  const d = new Date(ts);
  const n = new Date();
  return d.getDate() === n.getDate() && d.getMonth() === n.getMonth() && d.getFullYear() === n.getFullYear();
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export class TimerTreeProvider implements vscode.TreeDataProvider<TimerTreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<TimerTreeItem | undefined>();
  readonly onDidChangeTreeData: vscode.Event<TimerTreeItem | undefined> = this._onDidChangeTreeData.event;

  private timer: TimerManager;
  private storage: StorageManager;

  constructor(timer: TimerManager, storage: StorageManager) {
    this.timer = timer;
    this.storage = storage;
    timer.onDidChangeState(() => this.refresh());
  }

  refresh() {
    this._onDidChangeTreeData.fire(undefined);
  }

  getTreeItem(element: TimerTreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: TimerTreeItem): Thenable<TimerTreeItem[]> {
    if (!element) {
      return Promise.resolve(this.buildRootItems());
    }
    return Promise.resolve(element.children ?? []);
  }

  private buildRootItems(): TimerTreeItem[] {
    const state = this.timer.getState();
    const sessions = this.getWorkSessions();
    const todaySessions = sessions.filter((s) => isToday(s.timestamp));
    const totalMinutes = todaySessions.reduce((sum, s) => sum + Math.round(s.duration / 60), 0);
    const streak = calcStreak(sessions);
    const longBreakInterval = vscode.workspace.getConfiguration('cut-a-while').get<number>('longBreakInterval', 4);
    const nextLongBreak = `${longBreakInterval - (state.completedSessions % longBreakInterval)} until long break`;

    const statusIcon: Record<string, string> = {
      idle: 'watch',
      running: 'play-circle',
      paused: 'debug-pause',
      break: 'coffee',
      stopped: 'stop-circle',
    };

    const statusLabel: Record<string, string> = {
      idle: 'Ready',
      running: 'Focus',
      paused: 'Paused',
      break: 'Break',
      stopped: 'Stopped',
    };

    const sessionChildren: TimerTreeItem[] = [
      new TimerTreeItem('Status', vscode.TreeItemCollapsibleState.None, statusLabel[state.status], statusIcon[state.status]),
      new TimerTreeItem('Time Left', vscode.TreeItemCollapsibleState.None, formatTime(state.timeLeft), 'watch'),
      new TimerTreeItem('Cycle', vscode.TreeItemCollapsibleState.None, `${state.cycleType === 'work' ? 'Focus' : 'Break'} ${state.completedSessions + 1}/${longBreakInterval}`, 'symbol-ruler'),
      new TimerTreeItem(nextLongBreak, vscode.TreeItemCollapsibleState.None, undefined, 'info'),
    ];

    const todayChildren: TimerTreeItem[] = [
      new TimerTreeItem('Pomodoros', vscode.TreeItemCollapsibleState.None, `${todaySessions.length}`, 'check'),
      new TimerTreeItem('Focus Time', vscode.TreeItemCollapsibleState.None, `${totalMinutes} min`, 'clock'),
    ];

    if (state.completedSessions > 0) {
      todayChildren.unshift(
        new TimerTreeItem('Session count', vscode.TreeItemCollapsibleState.None, `${state.completedSessions} today`, 'symbol-number'),
      );
    }

    const streakChildren: TimerTreeItem[] = [
      new TimerTreeItem('Current', vscode.TreeItemCollapsibleState.None, `${streak} day${streak !== 1 ? 's' : ''}`, 'flame'),
    ];

    return [
      new TimerTreeItem('Current Session', vscode.TreeItemCollapsibleState.Expanded, undefined, 'zap', undefined, sessionChildren),
      new TimerTreeItem('Today', vscode.TreeItemCollapsibleState.Expanded, undefined, 'calendar', undefined, todayChildren),
      new TimerTreeItem('Streak', vscode.TreeItemCollapsibleState.Collapsed, undefined, 'dashboard', undefined, streakChildren),
    ];
  }

  private getWorkSessions(): Session[] {
    return this.storage.get<Session[]>('sessions', []).filter((s) => s.type === 'work');
  }
}
