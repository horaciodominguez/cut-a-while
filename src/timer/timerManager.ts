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

export class TimerManager implements vscode.Disposable {
  private state: TimerState;
  private tickTimer: ReturnType<typeof setTimeout> | null = null;
  private storage: StorageManager;
  private _onDidChangeState = new vscode.EventEmitter<TimerState>();
  readonly onDidChangeState: vscode.Event<TimerState> = this._onDidChangeState.event;

  constructor(storage: StorageManager) {
    this.storage = storage;
    this.state = this.getDefaultState();
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
      workDuration: Math.round(config.get<number>('workDuration', 1) * 60),
      breakDuration: Math.round(config.get<number>('breakDuration', 0.25) * 60),
      longBreakDuration: Math.round(config.get<number>('longBreakDuration', 1) * 60),
      longBreakInterval: config.get<number>('longBreakInterval', 4),
      autoStart: config.get<boolean>('autoStart', true),
    };
  }

  getState(): TimerState {
    return { ...this.state };
  }

  start(task?: string) {
    if (this.state.status === 'running') return;

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
    if (this.state.status !== 'running') return;
    this.state.status = 'paused';
    this.stopTick();
    this.emit();
  }

  resume() {
    if (this.state.status !== 'paused') return;
    this.state.status = 'running';
    this.startTick();
    this.emit();
  }

  stop() {
    this.state.status = 'stopped';
    this.stopTick();
    this.emit();
  }

  reset() {
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
    if (this.state.status !== 'break') return;
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
    this.tick();
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
    this.stopTick();

    const config = this.getConfig();
    const session = {
      timestamp: Date.now(),
      type: this.state.cycleType,
      duration: this.state.totalTime,
      task: this.state.currentTask,
    };
    await this.storage.pushToArray('sessions', session).catch(() => {});
    await this.saveState();

    if (this.state.cycleType === 'work') {
      this.state.completedSessions++;
      const isLongBreak = this.state.completedSessions % config.longBreakInterval === 0;
      this.state.timeLeft = isLongBreak ? config.longBreakDuration : config.breakDuration;
      this.state.totalTime = this.state.timeLeft;
      this.state.status = 'break';
      this.state.cycleType = 'break';
      this.state.currentTask = '';
      this.startTick();
      this.emit();
      return;
    }

    this.state.timeLeft = config.workDuration;
    this.state.totalTime = config.workDuration;
    this.state.cycleType = 'work';
    this.state.currentTask = '';
    this.state.status = 'idle';
    this.emit();

    if (config.autoStart) {
      this.state.status = 'running';
      this.state.totalTime = config.workDuration;
      this.startTick();
      this.emit();
    }
  }

  private emit() {
    this._onDidChangeState.fire({ ...this.state });
  }

  private async saveState() {
    await this.storage.set('timerState', this.state).catch(() => {});
  }

  dispose() {
    this.stopTick();
    this._onDidChangeState.dispose();
  }
}
