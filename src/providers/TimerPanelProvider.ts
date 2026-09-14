import * as vscode from 'vscode';
import { calcStreak } from '../core/utils/streak.js';
import { TimerManager } from '../timer/timerManager.js';
import { playHostCompletionSound } from '../hostSound.js';

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
      this.webviewView.webview.postMessage({ command: 'openStats' });
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

    webviewView.webview.onDidReceiveMessage((message) => {
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
        case 'reset':
          this.timer.reset();
          break;
        case 'setTask':
          this.timer.setTask(message.task);
          break;
        case 'getState':
          this.postState();
          break;
        case 'getSettings':
          this.postSettings();
          break;
        case 'updateSetting':
          this.updateSetting(message.key, message.value);
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
          this.handleAddTodo(message.text);
          break;
        case 'toggleTodo':
          this.handleToggleTodo(message.id);
          break;
        case 'deleteTodo':
          this.handleDeleteTodo(message.id);
          break;
      }
    });

    const stateDisposable = this.timer.onDidChangeState(() => this.postState());
    const soundDisposable = this.timer.onDidCompleteCycle((type) => this.postPlaySound(type));
    webviewView.onDidDispose(() => {
      stateDisposable.dispose();
      soundDisposable.dispose();
    });
    this.postState();
  }

  private postPlaySound(type: 'work' | 'break') {
    const config = vscode.workspace.getConfiguration('cut-a-while');
    if (!config.get<boolean>('sound.enabled', true)) return;

    // Windows: webview audio is blocked without panel focus — use OS beep for completion.
    if (process.platform === 'win32') {
      playHostCompletionSound(type);
      return;
    }

    const theme = config.get<string>('soundTheme', 'bell');
    const webview = this.webviewView?.webview;
    const panelVisible = this.webviewView?.visible ?? false;

    if (webview) {
      try {
        webview.postMessage({ command: 'playSound', type, theme });
      } catch {
        playHostCompletionSound(type);
        return;
      }
    }

    if (!webview || !panelVisible) {
      playHostCompletionSound(type);
    }
  }

  private postState() {
    if (!this.webviewView) return;
    try {
      const state = this.timer.getState();
      const sessions = this.timer.getSessions();
      this.webviewView.webview.postMessage({ command: 'stateUpdate', ...state, streak: calcStreak(sessions) });
    } catch {
      // Webview disposed — ignore
    }
  }

  private postSettings() {
    if (!this.webviewView) return;
    try {
      const config = vscode.workspace.getConfiguration('cut-a-while');
      this.webviewView.webview.postMessage({
        command: 'settingsUpdate',
        settings: {
          workDuration: config.get<number>('workDuration', 25),
          breakDuration: config.get<number>('breakDuration', 5),
          longBreakDuration: config.get<number>('longBreakDuration', 15),
          longBreakInterval: config.get<number>('longBreakInterval', 4),
          autoStart: config.get<boolean>('autoStart', true),
          soundEnabled: config.get<boolean>('sound.enabled', true),
          soundTheme: config.get<string>('soundTheme', 'bell'),
          zenMode: config.get<boolean>('zenMode', false),
          accent: config.get<string>('theme.accent', 'blue'),
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
      this.webviewView.webview.postMessage({ command: 'sessionsUpdate', sessions });
    } catch {
      // Webview disposed — ignore
    }
  }

  private postTodos() {
    if (!this.webviewView) return;
    try {
      const todos = this.timer.getTodos();
      this.webviewView.webview.postMessage({ command: 'todosUpdate', todos });
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
      this.webviewView.webview.postMessage({ command: 'projectFocusUpdate', projects: data });
    } catch {
      // Webview disposed — ignore
    }
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
