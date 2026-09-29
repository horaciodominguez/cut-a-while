import * as vscode from 'vscode';
import { calcStreak } from '../core/utils/streak.js';
import {
  playHostCompletionSound,
  resolveCompletionSoundRoute,
  resolvePreviewSoundRoute,
} from '../hostSound.js';
import { isWebviewToHostMessage, type HostToWebviewMessage } from '../shared/messages.js';
import { TimerManager } from '../timer/timerManager.js';

export class TimerPanelProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'cut-a-while.timerPanel';

  private webviewView: vscode.WebviewView | undefined;
  private timer: TimerManager;
  private extensionUri: vscode.Uri;

  constructor(extensionUri: vscode.Uri, timer: TimerManager) {
    this.extensionUri = extensionUri;
    this.timer = timer;
  }

  openStats() {
    if (!this.webviewView) return;
    try {
      this.webviewView.show?.(true);
      this.post({ command: 'openStats' });
    } catch {
      // Webview disposed — ignore
    }
  }

  resolveWebviewView(webviewView: vscode.WebviewView) {
    this.webviewView = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.extensionUri],
    };

    webviewView.webview.html = this.getWebviewHtml(webviewView.webview);

    const messageDisposable = webviewView.webview.onDidReceiveMessage((message: unknown) => {
      if (!isWebviewToHostMessage(message)) return;
      switch (message.command) {
        case 'start':
          this.timer.start(message.task);
          break;
        case 'pause':
          this.timer.pause();
          break;
        case 'resume':
          this.timer.resume();
          break;
        case 'stop':
          this.timer.stop();
          break;
        case 'confirmStop':
          void this.confirmStop().catch(() => {});
          break;
        case 'reset':
          this.timer.reset();
          break;
        case 'confirmReset':
          void this.confirmReset().catch(() => {});
          break;
        case 'setTask':
          void this.timer.setTask(message.task).catch(() => {});
          break;
        case 'getState':
          this.postState();
          break;
        case 'getSettings':
          this.postSettings();
          break;
        case 'updateSetting':
          void this.updateSetting(message.key, message.value).catch(() => {
            void vscode.window.showErrorMessage('Cut a While: could not save setting');
          });
          break;
        case 'skipBreak':
          this.timer.skipBreak();
          break;
        case 'getSessions':
          this.postSessions();
          break;
        case 'getTodos':
          this.postTodos();
          break;
        case 'getProjectFocus':
          this.postProjectFocus();
          break;
        case 'addTodo':
          void this.handleAddTodo(message.text).catch(() => {});
          break;
        case 'toggleTodo':
          void this.handleToggleTodo(message.id).catch(() => {});
          break;
        case 'deleteTodo':
          void this.handleDeleteTodo(message.id).catch(() => {});
          break;
        case 'previewSound':
          this.previewSound(message.theme, message.type === 'work' ? 'work' : 'break');
          break;
      }
    });

    const stateDisposable = this.timer.onDidChangeState(() => this.postState());
    const soundDisposable = this.timer.onDidCompleteCycle((type) => this.postPlaySound(type));
    const configDisposable = vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('cut-a-while')) {
        this.postSettings();
      }
    });
    webviewView.onDidDispose(() => {
      messageDisposable.dispose();
      stateDisposable.dispose();
      soundDisposable.dispose();
      configDisposable.dispose();
      this.webviewView = undefined;
    });
    this.postState();
  }

  private post(message: HostToWebviewMessage) {
    this.webviewView?.webview.postMessage(message);
  }

  private postPlaySound(type: 'work' | 'break') {
    const config = vscode.workspace.getConfiguration('cut-a-while');
    const theme = config.get<string>('soundTheme', 'bell');
    const hasWebview = !!this.webviewView?.webview;
    const route = resolveCompletionSoundRoute({
      enabled: config.get<boolean>('sound.enabled', true),
      platform: process.platform,
      hasWebview,
      panelVisible: this.webviewView?.visible ?? false,
    });

    if (route === 'silent') return;
    if (route === 'host' || route === 'both') {
      playHostCompletionSound(type, theme);
    }
    if (route === 'webview' || route === 'both') {
      try {
        this.post({ command: 'playSound', type, theme });
      } catch {
        if (route !== 'both') playHostCompletionSound(type, theme);
      }
    }
  }

  /** Theme picker preview — always audible; on Windows matches completion (host beep). */
  private previewSound(theme = 'bell', type: 'work' | 'break' = 'break') {
    const route = resolvePreviewSoundRoute(process.platform, !!this.webviewView?.webview);
    if (route === 'host') {
      playHostCompletionSound(type, theme);
      return;
    }
    try {
      this.post({ command: 'playSound', type, theme, preview: true });
    } catch {
      playHostCompletionSound(type, theme);
    }
  }

  private postState() {
    if (!this.webviewView) return;
    try {
      const state = this.timer.getState();
      const sessions = this.timer.getSessions();
      this.post({ command: 'stateUpdate', ...state, streak: calcStreak(sessions) });
    } catch {
      // Webview disposed — ignore
    }
  }

  private postSettings() {
    if (!this.webviewView) return;
    try {
      const config = vscode.workspace.getConfiguration('cut-a-while');
      this.post({
        command: 'settingsUpdate',
        settings: {
          workDuration: config.get<number>('workDuration', 25),
          breakDuration: config.get<number>('breakDuration', 5),
          longBreakDuration: config.get<number>('longBreakDuration', 15),
          longBreakInterval: config.get<number>('longBreakInterval', 4),
          autoStart: config.get<boolean>('autoStart', true),
          autoPause: config.get<boolean>('autoPause', true),
          soundEnabled: config.get<boolean>('sound.enabled', true),
          soundTheme: config.get<string>('soundTheme', 'bell'),
          zenMode: config.get<boolean>('zenMode', false),
          accent: config.get<string>('theme.accent', 'blue'),
          platform: process.platform,
        },
      });
    } catch {
      // Webview disposed — ignore
    }
  }

  private postSessions() {
    if (!this.webviewView) return;
    try {
      const sessions = this.timer.getSessions();
      this.post({ command: 'sessionsUpdate', sessions });
    } catch {
      // Webview disposed — ignore
    }
  }

  private postTodos() {
    if (!this.webviewView) return;
    try {
      const todos = this.timer.getTodos();
      this.post({ command: 'todosUpdate', todos });
    } catch {
      // Webview disposed — ignore
    }
  }

  private async handleAddTodo(text: string) {
    await this.timer.addTodo(text);
    this.postTodos();
  }

  private async handleToggleTodo(id: string) {
    await this.timer.toggleTodo(id);
    this.postTodos();
  }

  private async handleDeleteTodo(id: string) {
    await this.timer.deleteTodo(id);
    this.postTodos();
  }

  private postProjectFocus() {
    if (!this.webviewView) return;
    try {
      const data = this.timer.getProjectFocusTimes();
      this.post({ command: 'projectFocusUpdate', projects: data });
    } catch {
      // Webview disposed — ignore
    }
  }

  private async confirmStop() {
    const action = await vscode.window.showWarningMessage(
      'Cut a While: Stop the current session? Progress on this cycle will be discarded.',
      { modal: true },
      'Stop',
    );
    if (action === 'Stop') {
      this.timer.stop();
    }
  }

  private async confirmReset() {
    const state = this.timer.getState();
    const needsConfirm =
      state.status === 'running' ||
      state.status === 'paused' ||
      state.status === 'break' ||
      state.status === 'stopped' ||
      state.completedSessions > 0;
    if (needsConfirm) {
      const action = await vscode.window.showWarningMessage(
        'Cut a While: Reset timer and clear session progress for this cycle?',
        { modal: true },
        'Reset',
      );
      if (action !== 'Reset') return;
    }
    this.timer.reset();
  }

  private async updateSetting(key: string, value: unknown) {
    const configKey = `cut-a-while.${this.configKeyMap(key)}`;
    await vscode.workspace.getConfiguration().update(configKey, value, vscode.ConfigurationTarget.Global);
  }

  private configKeyMap(key: string): string {
    const map: Record<string, string> = {
      workDuration: 'workDuration',
      breakDuration: 'breakDuration',
      longBreakDuration: 'longBreakDuration',
      longBreakInterval: 'longBreakInterval',
      autoStart: 'autoStart',
      autoPause: 'autoPause',
      soundEnabled: 'sound.enabled',
      soundTheme: 'soundTheme',
      zenMode: 'zenMode',
      accent: 'theme.accent',
    };
    return map[key] || key;
  }

  private getWebviewHtml(webview: vscode.Webview): string {
    const assetsPath = vscode.Uri.joinPath(this.extensionUri, 'out', 'webview');

    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(assetsPath, 'assets', 'index.js'),
    );
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(assetsPath, 'assets', 'index.css'),
    );

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <link rel="stylesheet" href="${styleUri}">
  <title>Cut a While</title>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="${scriptUri}"></script>
</body>
</html>`;
  }
}
