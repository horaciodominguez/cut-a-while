/** Host ↔ webview message contract. Keep commands in sync with both sides. */

export type CycleKind = 'work' | 'break';

export type WebviewToHostMessage =
  | { command: 'start'; task?: string }
  | { command: 'pause' }
  | { command: 'resume' }
  | { command: 'stop' }
  | { command: 'confirmStop' }
  | { command: 'reset' }
  | { command: 'confirmReset' }
  | { command: 'setTask'; task: string }
  | { command: 'getState' }
  | { command: 'getSettings' }
  | { command: 'updateSetting'; key: string; value: unknown }
  | { command: 'skipBreak' }
  | { command: 'getSessions' }
  | { command: 'getTodos' }
  | { command: 'getProjectFocus' }
  | { command: 'addTodo'; text: string }
  | { command: 'toggleTodo'; id: string }
  | { command: 'deleteTodo'; id: string }
  | { command: 'previewSound'; theme?: string; type?: CycleKind };

export type HostToWebviewMessage =
  | {
      command: 'stateUpdate';
      status: string;
      timeLeft: number;
      totalTime: number;
      cycleType: CycleKind;
      completedSessions: number;
      currentTask: string;
      streak: number;
      todayCount: number;
    }
  | {
      command: 'settingsUpdate';
      settings: {
        workDuration: number;
        breakDuration: number;
        longBreakDuration: number;
        longBreakInterval: number;
        autoStart: boolean;
        autoPause: boolean;
        soundEnabled: boolean;
        soundTheme: string;
        zenMode: boolean;
        accent: string;
        platform: string;
      };
    }
  | { command: 'sessionsUpdate'; sessions: unknown[] }
  | { command: 'todosUpdate'; todos: unknown[] }
  | { command: 'projectFocusUpdate'; projects: Record<string, number> }
  | { command: 'openStats' }
  | { command: 'playSound'; type: CycleKind; theme?: string; preview?: boolean };

const WEBVIEW_COMMANDS = new Set<WebviewToHostMessage['command']>([
  'start',
  'pause',
  'resume',
  'stop',
  'confirmStop',
  'reset',
  'confirmReset',
  'setTask',
  'getState',
  'getSettings',
  'updateSetting',
  'skipBreak',
  'getSessions',
  'getTodos',
  'getProjectFocus',
  'addTodo',
  'toggleTodo',
  'deleteTodo',
  'previewSound',
]);

export function isWebviewToHostMessage(value: unknown): value is WebviewToHostMessage {
  if (typeof value !== 'object' || value === null) return false;
  const command = (value as { command?: unknown }).command;
  return typeof command === 'string' && WEBVIEW_COMMANDS.has(command as WebviewToHostMessage['command']);
}
