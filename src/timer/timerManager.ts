import * as vscode from 'vscode';
import type { StorageManager } from '../storage/store.js';

export type TimerStatus = 'idle' | 'running' | 'paused' | 'stopped' | 'break';
export type CycleType = 'work' | 'break';

export interface TimerState {
  status: TimerStatus;
  timeLeft: number;
  totalTime: number;
  cycleType: CycleType;
  completedSessions: number;
  currentTask: string;
}

interface PersistedTimerState extends TimerState {
  savedAt: number;
}

export interface Session {
  timestamp: number;
  type: CycleType;
  duration: number;
  task: string;
}

export interface TodoItem {
  id: string;
  text: string;
  done: boolean;
  createdAt: number;
  completedAt?: number;
}

export class TimerManager implements vscode.Disposable {
  private state: TimerState;
  private tickTimer: ReturnType<typeof setTimeout> | null = null;
  private completing = false;
  private pendingCompletedCycle: CycleType | null = null;
  private storage: StorageManager;
  private _onDidChangeState = new vscode.EventEmitter<TimerState>();
  readonly onDidChangeState: vscode.Event<TimerState> = this._onDidChangeState.event;
  private _onDidCompleteCycle = new vscode.EventEmitter<CycleType>();
  /** Fires with the cycle that just finished: work or break. */
  readonly onDidCompleteCycle: vscode.Event<CycleType> = this._onDidCompleteCycle.event;

  constructor(storage: StorageManager) {
    this.storage = storage;
    this.state = this.restoreState() ?? this.getDefaultState();
    if (this.state.status === 'running' || this.state.status === 'break') {
      this.startTick();
    }
    // Fire after activate() wires listeners (TimerPanelProvider, etc.).
    if (this.pendingCompletedCycle) {
      const cycle = this.pendingCompletedCycle;
      this.pendingCompletedCycle = null;
      setTimeout(() => this._onDidCompleteCycle.fire(cycle), 0);
    }
  }

  private restoreState(): TimerState | null {
    const saved = this.storage.get<PersistedTimerState | null>('timerState', null);
    if (!saved || typeof saved.timeLeft !== 'number') return null;

    const { savedAt, ...rest } = saved;
    const state: TimerState = {
      status: rest.status,
      timeLeft: rest.timeLeft,
      totalTime: rest.totalTime,
      cycleType: rest.cycleType,
      completedSessions: rest.completedSessions ?? 0,
      currentTask: rest.currentTask ?? '',
    };

    if (state.status === 'running' || state.status === 'break') {
      const originalTimeLeft = state.timeLeft;
      const elapsed = Math.floor((Date.now() - (savedAt || Date.now())) / 1000);
      state.timeLeft = Math.max(0, originalTimeLeft - elapsed);
      if (state.timeLeft <= 0) {
        this.applyExpiredRestore(state, savedAt, originalTimeLeft);
      }
    } else if (state.status === 'stopped') {
      // Keep stopped as restored
    } else if (state.status !== 'paused') {
      state.status = 'idle';
    }

    return state;
  }

  /** Register the finished cycle and advance to the next phase (mirrors handleCompletion). */
  private applyExpiredRestore(
    state: TimerState,
    savedAt: number | undefined,
    originalTimeLeft: number,
  ): void {
    const config = this.getConfig();
    const finished = state.cycleType;
    const endedAt =
      typeof savedAt === 'number' ? savedAt + originalTimeLeft * 1000 : Date.now();

    void this.storage
      .pushToArray('sessions', {
        timestamp: endedAt,
        type: finished,
        duration: state.totalTime,
        task: state.currentTask,
      })
      .catch(() => {});

    this.pendingCompletedCycle = finished;

    if (finished === 'work') {
      state.completedSessions++;
      const isLongBreak = state.completedSessions % config.longBreakInterval === 0;
      state.timeLeft = isLongBreak ? config.longBreakDuration : config.breakDuration;
      state.totalTime = state.timeLeft;
      state.status = 'break';
      state.cycleType = 'break';
      state.currentTask = '';
      return;
    }

    state.timeLeft = config.workDuration;
    state.totalTime = config.workDuration;
    state.cycleType = 'work';
    state.currentTask = '';
    state.status = 'idle';
    if (config.autoStart) {
      state.status = 'running';
    }
  }

  private getDefaultState(): TimerState {
    const config = this.getConfig();
    return {
      status: 'idle',
      timeLeft: config.workDuration,
      totalTime: config.workDuration,
      cycleType: 'work',
      completedSessions: 0,
      currentTask: '',
    };
  }

  private getConfig() {
    const config = vscode.workspace.getConfiguration('cut-a-while');
    return {
      workDuration: Math.round(config.get<number>('workDuration', 25) * 60),
      breakDuration: Math.round(config.get<number>('breakDuration', 5) * 60),
      longBreakDuration: Math.round(config.get<number>('longBreakDuration', 15) * 60),
      longBreakInterval: config.get<number>('longBreakInterval', 4),
      autoStart: config.get<boolean>('autoStart', true),
    };
  }

  getState(): TimerState {
    return { ...this.state };
  }

  getSessions(): Session[] {
    return this.storage.get<Session[]>('sessions', []);
  }

  getTodos(): TodoItem[] {
    return this.storage.get<TodoItem[]>('todos', []);
  }

  getProjectFocusTimes(): Record<string, number> {
    return this.storage.get<Record<string, number>>('projectFocus', {});
  }

  async addTodo(text: string): Promise<TodoItem> {
    const todos = this.getTodos();
    const todo: TodoItem = {
      id: `${Date.now()}-${Math.random()}`,
      text,
      done: false,
      createdAt: Date.now(),
    };
    todos.push(todo);
    await this.storage.set('todos', todos);
    return todo;
  }

  async toggleTodo(id: string): Promise<void> {
    const todos = this.getTodos();
    const todo = todos.find((t) => t.id === id);
    if (!todo) return;
    todo.done = !todo.done;
    todo.completedAt = todo.done ? Date.now() : undefined;
    await this.storage.set('todos', todos);
  }

  async deleteTodo(id: string): Promise<void> {
    const todos = this.getTodos().filter((t) => t.id !== id);
    await this.storage.set('todos', todos);
  }

  start(task?: string) {
    if (this.completing || this.state.status === 'running') return;

    if (task) {
      this.state.currentTask = task;
    }

    if (this.state.status === 'idle' || this.state.status === 'stopped' || this.state.status === 'break') {
      const config = this.getConfig();
      this.state.timeLeft = config.workDuration;
      this.state.totalTime = config.workDuration;
      this.state.cycleType = 'work';
    }

    this.state.status = 'running';
    this.startTick();
    this.emit();
  }

  pause() {
    if (this.completing) return;
    if (this.state.status !== 'running' && this.state.status !== 'break') return;
    this.state.status = 'paused';
    this.stopTick();
    this.emit();
  }

  resume() {
    if (this.completing || this.state.status !== 'paused') return;
    this.state.status = this.state.cycleType === 'break' ? 'break' : 'running';
    this.startTick();
    this.emit();
  }

  stop() {
    if (this.completing) return;
    this.state.status = 'stopped';
    this.stopTick();
    this.emit();
  }

  reset() {
    if (this.completing) return;
    this.stopTick();
    const config = this.getConfig();
    this.state = {
      status: 'idle',
      timeLeft: config.workDuration,
      totalTime: config.workDuration,
      cycleType: 'work',
      completedSessions: 0,
      currentTask: '',
    };
    this.emit();
  }

  async setTask(task: string) {
    this.state.currentTask = task;
    await this.saveState();
  }

  skipBreak() {
    if (this.completing || this.state.status !== 'break') return;
    this.state.currentTask = '';
    const config = this.getConfig();
    this.state.timeLeft = config.workDuration;
    this.state.totalTime = config.workDuration;
    this.state.cycleType = 'work';
    this.state.status = 'running';
    this.startTick();
    this.emit();
  }

  private startTick() {
    this.stopTick();
    this.tickTimer = setTimeout(() => this.tick(), 1000);
  }

  private tick() {
    if (this.state.status !== 'running' && this.state.status !== 'break') return;
    this.state.timeLeft--;
    if (this.state.timeLeft <= 0) {
      this.handleCompletion().catch(() => {});
      return;
    }
    this.emit();
    this.tickTimer = setTimeout(() => this.tick(), 1000);
  }

  private stopTick() {
    if (this.tickTimer !== null) {
      clearTimeout(this.tickTimer);
      this.tickTimer = null;
    }
  }

  private async handleCompletion() {
    if (this.completing) return;
    this.completing = true;
    this.stopTick();

    try {
      const config = this.getConfig();
      const finishedCycle = this.state.cycleType;
      const session = {
        timestamp: Date.now(),
        type: finishedCycle,
        duration: this.state.totalTime,
        task: this.state.currentTask,
      };
      await this.storage.pushToArray('sessions', session).catch(() => {});
      await this.saveState();

      if (finishedCycle === 'work') {
        this.state.completedSessions++;
        const isLongBreak = this.state.completedSessions % config.longBreakInterval === 0;
        this.state.timeLeft = isLongBreak ? config.longBreakDuration : config.breakDuration;
        this.state.totalTime = this.state.timeLeft;
        this.state.status = 'break';
        this.state.cycleType = 'break';
        this.state.currentTask = '';
        this.startTick();
        this._onDidCompleteCycle.fire('work');
        this.emit();
        return;
      }

      this.state.timeLeft = config.workDuration;
      this.state.totalTime = config.workDuration;
      this.state.cycleType = 'work';
      this.state.currentTask = '';
      this.state.status = 'idle';
      this._onDidCompleteCycle.fire('break');
      this.emit();

      if (config.autoStart) {
        this.state.status = 'running';
        this.state.totalTime = config.workDuration;
        this.startTick();
        this.emit();
      }
    } finally {
      this.completing = false;
    }
  }

  private emit() {
    this._onDidChangeState.fire({ ...this.state });
    this.saveState().catch(() => {});
  }

  private async saveState() {
    const payload: PersistedTimerState = { ...this.state, savedAt: Date.now() };
    await this.storage.set('timerState', payload).catch(() => {});
  }

  dispose() {
    this.stopTick();
    this._onDidChangeState.dispose();
    this._onDidCompleteCycle.dispose();
  }
}
