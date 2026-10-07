import * as vscode from 'vscode';
import { calcStreak } from '../core/utils/streak.js';
import { todayWorkSessions } from '../core/utils/time.js';
import { TimerManager, type Session, type TimerState } from '../timer/timerManager.js';
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

export class TimerTreeProvider implements vscode.TreeDataProvider<TimerTreeItem>, vscode.Disposable {
  private _onDidChangeTreeData = new vscode.EventEmitter<TimerTreeItem | undefined>();
  readonly onDidChangeTreeData: vscode.Event<TimerTreeItem | undefined> = this._onDidChangeTreeData.event;

  private storage: StorageManager;
  private stateDisposable: vscode.Disposable;
  private snapshot: string;

  constructor(timer: TimerManager, storage: StorageManager) {
    this.storage = storage;
    this.snapshot = this.snapshotOf(timer.getState());
    this.stateDisposable = timer.onDidChangeState((state) => this.onState(state));
  }

  private snapshotOf(state: TimerState): string {
    return `${state.status}:${state.completedSessions}`;
  }

  /** Rebuild only when phase or the cycle counter changes. The clock already lives in the status bar. */
  private onState(state: TimerState) {
    const next = this.snapshotOf(state);
    if (next === this.snapshot) return;
    this.snapshot = next;
    this._onDidChangeTreeData.fire(undefined);
  }

  dispose() {
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
    const sessions = this.getWorkSessions();
    const todaySessions = todayWorkSessions(sessions);
    const totalMinutes = todaySessions.reduce((sum, s) => sum + Math.round(s.duration / 60), 0);
    const streak = calcStreak(sessions);

    const todayChildren: TimerTreeItem[] = [
      new TimerTreeItem('Pomodoros', vscode.TreeItemCollapsibleState.None, `${todaySessions.length}`, 'check'),
      new TimerTreeItem('Focus Time', vscode.TreeItemCollapsibleState.None, `${totalMinutes} min`, 'clock'),
    ];

    const streakChildren: TimerTreeItem[] = [
      new TimerTreeItem('Current', vscode.TreeItemCollapsibleState.None, `${streak} day${streak !== 1 ? 's' : ''}`, 'flame'),
    ];

    return [
      new TimerTreeItem(
        'Open Timer Panel',
        vscode.TreeItemCollapsibleState.None,
        'The timer UI is the bottom panel',
        'open-preview',
        { command: 'cut-a-while.showPanel', title: 'Open Timer Panel' },
      ),
      new TimerTreeItem('Today', vscode.TreeItemCollapsibleState.Expanded, undefined, 'calendar', undefined, todayChildren),
      new TimerTreeItem('Streak', vscode.TreeItemCollapsibleState.Collapsed, undefined, 'dashboard', undefined, streakChildren),
    ];
  }

  private getWorkSessions(): Session[] {
    return this.storage.get<Session[]>('sessions', []).filter((s) => s.type === 'work');
  }
}
