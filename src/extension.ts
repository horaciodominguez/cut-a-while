import * as vscode from 'vscode';
import { TimerManager } from './timer/timerManager.js';
import { StorageManager } from './storage/store.js';
import { StatusBarManager } from './statusBar.js';
import { CommandsManager } from './commands.js';
import { TimerPanelProvider } from './providers/TimerPanelProvider.js';
import { TimerTreeProvider } from './treeView/TimerTreeProvider.js';
import { FileFocusTracker } from './fileFocusTracker.js';

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

  const treeProvider = new TimerTreeProvider(timer, storage);
  context.subscriptions.push(
    vscode.window.registerTreeDataProvider('cut-a-while.timerTree', treeProvider),
  );

  const focusTracker = new FileFocusTracker(timer, storage);
  context.subscriptions.push(focusTracker);

  context.subscriptions.push(timer);
  context.subscriptions.push(statusBar);
}

export function deactivate() {}
