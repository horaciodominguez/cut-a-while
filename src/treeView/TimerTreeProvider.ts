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

const TREE_REFRESH_MS = 1000;

export class TimerTreeProvider implements vscode.TreeDataProvider<TimerTreeItem>, vscode.Disposable {
  private _onDidChangeTreeData = new vscode.EventEmitter<TimerTreeItem | undefined>();
  readonly onDidChangeTreeData: vscode.Event<TimerTreeItem | undefined> = this._onDidChangeTreeData.event;

  private timer: TimerManager;
  private storage: StorageManager;
  private stateDisposable: vscode.Disposable;
  private refreshTimer: ReturnType<typeof setTimeout> | undefined;
  private lastRefresh = 0;

  constructor(timer: TimerManager, storage: StorageManager) {
    this.timer = timer;
    this.storage = storage;
    this.stateDisposable = timer.onDidChangeState(() => this.refresh());
  }

  /** At most one tree rebuild per second; bursts from completion coalesce. */
  refresh() {
    const now = Date.now();
    const elapsed = now - this.lastRefresh;
    if (elapsed >= TREE_REFRESH_MS) {
      this.flushRefresh();
      return;
    }
    if (this.refreshTimer) return;
    this.refreshTimer = setTimeout(() => {
      this.refreshTimer = undefined;
      this.flushRefresh();
    }, TREE_REFRESH_MS - elapsed);
  }

  private flushRefresh() {
    this.lastRefresh = Date.now();
    this._onDidChangeTreeData.fire(undefined);
  }

  dispose() {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = undefined;
    }
    this.stateDisposable.dispose();
    this._onDidChangeTreeData.dispose();
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

    const toggleLabel =
      state.status === 'running' ? 'Pause' : state.status === 'break' ? 'Skip break' : 'Start';

    return [
      new TimerTreeItem(
        'Open Timer Panel',
        vscode.TreeItemCollapsibleState.None,
        'The timer UI is the bottom panel',
        'open-preview',
        { command: 'cut-a-while.showPanel', title: 'Open Timer Panel' },
      ),
      new TimerTreeItem(
        toggleLabel,
        vscode.TreeItemCollapsibleState.None,
        undefined,
        state.status === 'running' ? 'debug-pause' : 'play',
        { command: 'cut-a-while.toggle', title: 'Start / Pause' },
      ),
      new TimerTreeItem('Current Session', vscode.TreeItemCollapsibleState.Expanded, undefined, 'zap', undefined, sessionChildren),
      new TimerTreeItem('Today', vscode.TreeItemCollapsibleState.Expanded, undefined, 'calendar', undefined, todayChildren),
      new TimerTreeItem('Streak', vscode.TreeItemCollapsibleState.Collapsed, undefined, 'dashboard', undefined, streakChildren),
    ];
  }

  private getWorkSessions(): Session[] {
    return this.storage.get<Session[]>('sessions', []).filter((s) => s.type === 'work');
  }
}
