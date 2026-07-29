import * as vscode from 'vscode';
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
      }
    });

    const disposable = this.timer.onDidChangeState(() => this.postState());
    webviewView.onDidDispose(() => disposable.dispose());
    this.postState();
  }

  private postState() {
    if (!this.webviewView) return;
    const state = this.timer.getState();
    this.webviewView.webview.postMessage({ command: 'stateUpdate', ...state });
  }

  private postSettings() {
    if (!this.webviewView) return;
    const config = vscode.workspace.getConfiguration('cut-a-while');
    this.webviewView.webview.postMessage({
      command: 'settingsUpdate',
      settings: {
        workDuration: config.get<number>('workDuration', 1),
        breakDuration: config.get<number>('breakDuration', 0.25),
        longBreakDuration: config.get<number>('longBreakDuration', 1),
        longBreakInterval: config.get<number>('longBreakInterval', 4),
        autoStart: config.get<boolean>('autoStart', true),
        soundEnabled: config.get<boolean>('sound.enabled', true),
        accent: config.get<string>('theme.accent', 'blue'),
      },
    });
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

    const nonce = getNonce();

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}'; font-src ${webview.cspSource};">
  <link rel="stylesheet" href="${styleUri}">
  <title>Cut a While</title>
</head>
<body>
  <div id="root"></div>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }
}

function getNonce(): string {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 64; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
