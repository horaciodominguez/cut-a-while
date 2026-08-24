# Cut a While

Pomodoro timer for VS Code — stay focused, track your flow.

A minimal timer that lives in the editor: status bar, sidebar tree, and a panel webview that follows your VS Code theme.

## Features

- Work / short break / long break cycles
- Status bar countdown with one-click panel access
- Task list and session stats
- Optional Zen mode on focus start
- Configurable accent color and completion sounds
- Focus time tracking per file (hover) and per project

## Commands

| Command | Shortcut |
|---------|----------|
| Start / Pause Timer | `Ctrl+Shift+T` |
| Show Timer Panel | — |
| Reset Timer | — |
| Show Statistics | — |

Open the Command Palette (`Ctrl+Shift+P`) and search for **Cut a While**.

## Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `cut-a-while.workDuration` | `25` | Work session (minutes) |
| `cut-a-while.breakDuration` | `5` | Short break (minutes) |
| `cut-a-while.longBreakDuration` | `15` | Long break (minutes) |
| `cut-a-while.longBreakInterval` | `4` | Sessions before a long break |
| `cut-a-while.autoStart` | `true` | Auto-start the next cycle |
| `cut-a-while.sound.enabled` | `true` | Play sound on cycle complete |
| `cut-a-while.soundTheme` | `bell` | Sound theme |
| `cut-a-while.zenMode` | `false` | Enable Zen mode on focus start |
| `cut-a-while.statusBarAlignment` | `right` | Status bar position |
| `cut-a-while.theme.accent` | `blue` | Accent color for the timer UI |

## Development

```bash
npm install
npm run build
```

Press **F5** in VS Code to launch an Extension Development Host.

Watch mode:

```bash
npm run dev
```

Tests:

```bash
npm test
```

Package as `.vsix`:

```bash
npm run package
```
