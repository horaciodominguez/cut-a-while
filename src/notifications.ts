import * as vscode from 'vscode';

export class Notifications {
  static info(message: string) {
    vscode.window.showInformationMessage(`Cut a While: ${message}`);
  }

  static warn(message: string) {
    vscode.window.showWarningMessage(`Cut a While: ${message}`);
  }

  static error(message: string) {
    vscode.window.showErrorMessage(`Cut a While: ${message}`);
  }

  static async confirm(
    message: string,
    ...actions: string[]
  ): Promise<string | undefined> {
    return vscode.window.showInformationMessage(
      `Cut a While: ${message}`,
      { modal: false },
      ...actions,
    );
  }
}
