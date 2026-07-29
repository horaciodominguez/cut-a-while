import * as vscode from 'vscode';
import { TimerManager } from './timer/timerManager.js';
import { StorageManager } from './storage/store.js';
import { StatusBarManager } from './statusBar.js';
import { CommandsManager } from './commands.js';
import { TimerPanelProvider } from './providers/TimerPanelProvider.js';

export function activate(context: vscode.ExtensionContext) {
  const storage = new StorageManager(context);
  const timer = new TimerManager(storage);

  const statusBar = new StatusBarManager(timer);
  statusBar.init();

  const commands = new CommandsManager(timer);
  commands.register(context);

  const provider = new TimerPanelProvider(context.extensionUri, timer);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(TimerPanelProvider.viewType, provider),
  );

  context.subscriptions.push(timer);
  context.subscriptions.push(statusBar);
}

export function deactivate() {}
