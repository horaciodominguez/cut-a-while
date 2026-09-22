# Changelog

All notable changes to this project will be documented in this file.

## [0.1.3] - 2026-09-22

### Fixed

- Zen Mode exits safely on pause/break/stop (no blind toggle that re-enters Zen)
- Settings drawer scroll jump when settings sync from VS Code
- Nested / always-visible scrollbars in the Settings drawer
- Stop mid-session works via host confirmation (`window.confirm` is blocked in webviews)
- Reset confirmation aligned between panel and Command Palette
- Sound theme preview on Windows matches completion (system beeps per theme)

### Added

- Escape, focus trap, `aria-modal`, and reduced-motion support for drawers
- Bidirectional settings sync (VS Code Settings ↔ panel) with aligned slider ranges
- Session dots follow `longBreakInterval`
- Confirmation dialogs for destructive Stop and Reset

## [0.1.2] - 2026-09-14

### Fixed

- Streak calculation across month and year boundaries (e.g. Feb→Mar, Dec→Jan)
- Race when resetting/stopping during cycle completion
- Expired cycles while VS Code was closed are now recorded as completed sessions
- Auto-pause now pauses breaks correctly and resumes to the right phase
- Concurrent storage writes no longer overwrite each other
- Timer countdown stays accurate when the extension host delays ticks (wall-clock)

### Added

- `cut-a-while.autoPause` setting (and in-panel toggle) to disable pause-on-blur

## [0.1.1] - 2026-08-28

### Fixed

- Completion sounds now play while coding (not only when the timer panel has focus)
- Windows uses a reliable system beep on cycle completion
- Sound theme preview respects the Enabled toggle
- Marketplace category set to `Other` only (invalid `Productivity` removed)

## [0.1.0] - 2026-08-28

### Added

- Pomodoro timer with work, short break, and long break cycles
- Status bar countdown and activity bar tree view
- Timer panel webview with progress arc, session dots, and streak
- Task chips, todo drawer, and session statistics
- Six completion sound themes and six accent colors
- Optional Zen Mode on focus start
- Auto-pause when VS Code loses focus
- File and project focus time tracking
