import * as vscode from 'vscode';
import type { StorageManager } from '../storage/store.js';

export type TimerStatus = 'idle' | 'running' | 'paused' | 'stopped' | 'break';
export type CycleType = 'work' | 'break';

export interface TimerState {
  status: TimerStatus;
  timeLeft: number;
  cycleType: CycleType;
  completedSessions: number;
  currentTask: string;
}

export class TimerManager implements vscode.Disposable {
  private state: TimerState;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private storage: StorageManager;
  private _onDidChangeState = new vscode.EventEmitter<TimerState>();
  readonly onDidChangeState: vscode.Event<TimerState> = this._onDidChangeState.event;

  constructor(storage: StorageManager) {
    this.storage = storage;
    this.state = this.loadState();
  }

  private loadState(): TimerState {
    const config = this.getConfig();
    return this.storage.get('timerState', {
      status: 'idle',
      timeLeft: config.workDuration,
      cycleType: 'work',
      completedSessions: 0,
      currentTask: '',
    });
  }

  private async saveState() {
    await this.storage.set('timerState', this.state).catch(() => {});
  }

  private getConfig() {
    const config = vscode.workspace.getConfiguration('cut-a-while');
    return {
      workDuration: config.get<number>('workDuration', 25) * 60,
      breakDuration: config.get<number>('breakDuration', 5) * 60,
      longBreakDuration: config.get<number>('longBreakDuration', 15) * 60,
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

    if (this.state.status === 'idle' || this.state.status === 'stopped') {
      const config = this.getConfig();
      this.state.timeLeft = config.workDuration;
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
    this.state.cycleType = 'work';
    this.state.status = 'running';
    this.startTick();
    this.emit();
  }

  private async handleCompletion() {
    this.stopTick();
    this.state.completedSessions++;

    const config = this.getConfig();
    const session = {
      timestamp: Date.now(),
      type: this.state.cycleType,
      duration: config.workDuration,
      task: this.state.currentTask,
    };
    await this.storage.pushToArray('sessions', session).catch(() => {});
    await this.saveState();

    if (this.state.cycleType === 'work') {
      const isLongBreak = this.state.completedSessions % config.longBreakInterval === 0;
      this.state.timeLeft = isLongBreak ? config.longBreakDuration : config.breakDuration;
      this.state.status = 'break';
      this.state.cycleType = 'break';
      this.state.currentTask = '';
      this.startTick();
      this.emit();
      return;
    }

    this.state.timeLeft = config.workDuration;
    this.state.cycleType = 'work';
    this.state.currentTask = '';
    this.emit();

    if (config.autoStart) {
      this.state.status = 'running';
      this.startTick();
      this.emit();
    }
  }

  private startTick() {
    this.stopTick();
    this.intervalId = setInterval(() => {
      this.state.timeLeft--;
      if (this.state.timeLeft <= 0) {
        this.handleCompletion().catch(() => {});
        return;
      }
      this.emit();
    }, 1000);
  }

  private stopTick() {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  private emit() {
    this._onDidChangeState.fire({ ...this.state });
    this.saveState();
  }

  dispose() {
    this.stopTick();
    this._onDidChangeState.dispose();
  }
}
