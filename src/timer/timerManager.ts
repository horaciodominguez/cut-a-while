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

interface TimerConfig {
  workDuration: number;
  breakDuration: number;
  longBreakDuration: number;
  longBreakInterval: number;
  autoStart: boolean;
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
    return this.storage.get('timerState', {
      status: 'idle',
      timeLeft: this.getConfig().workDuration,
      cycleType: 'work',
      completedSessions: 0,
      currentTask: '',
    });
  }

  private saveState() {
    this.storage.set('timerState', this.state);
  }

  private getConfig(): TimerConfig {
    const config = vscode.workspace.getConfiguration('cut-a-while');
    return {
      workDuration: (config.get<number>('workDuration', 25)) * 60,
      breakDuration: (config.get<number>('breakDuration', 5)) * 60,
      longBreakDuration: (config.get<number>('longBreakDuration', 15)) * 60,
      longBreakInterval: config.get<number>('longBreakInterval', 4),
      autoStart: config.get<boolean>('autoStart', true),
    };
  }

  getState(): TimerState {
    return { ...this.state };
  }

  start(task?: string) {
    if (this.state.status === 'running') return;

    if (task) this.state.currentTask = task;

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

  setTask(task: string) {
    this.state.currentTask = task;
    this.saveState();
  }

  private handleCompletion() {
    this.stopTick();
    this.state.completedSessions++;

    const session = {
      timestamp: Date.now(),
      type: this.state.cycleType,
      duration: this.getConfig().workDuration,
      task: this.state.currentTask,
    };
    this.storage.pushToArray('sessions', session);
    this.saveState();

    if (this.state.cycleType === 'work') {
      const config = this.getConfig();
      const isLongBreak = this.state.completedSessions % config.longBreakInterval === 0;

      if (isLongBreak) {
        this.state.timeLeft = config.longBreakDuration;
        this.state.status = 'break';
      } else {
        this.state.timeLeft = config.breakDuration;
        this.state.status = 'break';
      }
      this.state.cycleType = 'break';
    } else {
      const config = this.getConfig();
      this.state.timeLeft = config.workDuration;
      this.state.cycleType = 'work';
      this.state.currentTask = '';
    }

    this.emit();

    if (this.getConfig().autoStart) {
      this.state.status = 'running';
      this.startTick();
      this.emit();
    }
  }

  private startTick() {
    this.stopTick();
    this.intervalId = setInterval(() => {
      if (this.state.timeLeft <= 0) {
        this.handleCompletion();
        return;
      }
      this.state.timeLeft--;
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
    this.saveState();
    this._onDidChangeState.fire({ ...this.state });
  }

  dispose() {
    this.stopTick();
    this._onDidChangeState.dispose();
  }
}
