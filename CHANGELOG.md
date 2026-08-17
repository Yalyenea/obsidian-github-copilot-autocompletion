# Changelog

## Unreleased

- Fixed Node path detection treating Homebrew symlinks (e.g. `/opt/homebrew/bin/node`) as missing.
- Encoded `file://` URIs for vault paths with spaces/non-ASCII characters.
- Upgraded Copilot language server to `1.520.0`.
- Handle `workspace/configuration` and push `workspace/didChangeConfiguration` (proxy/telemetry).
- Apply auth state from `didChangeStatus` / `statusNotification` notifications.
- Rebind workspace events via `EventRef` + `offref` without `registerEvent` leaks.
- Added unit/integration tests (`just test`).
- Hardened runtime after the sign-in fix: JSON-RPC request timeouts, GitHub-only external URL open, completion error handling, agent path preflight, incomplete language-server download cleanup, event listener unregister, and no Node re-test on every keystroke.
- Fixed Copilot sign-in hanging with no UI feedback: replaced the broken JSON-RPC id matcher, handle `window/showDocument`, open the device URL from Obsidian, and stop leaving orphan language-server processes after `shell:true` kills.
- Sign-in now reuses existing local Copilot credentials when already authenticated, polls status while waiting, and reports startup failures instead of doing nothing.
- Removed remaining Copilot Chat styles, rules, demo assets, and metadata.
- Rebuilt the settings tab with Obsidian native controls and removed React from the runtime dependency surface.
- Removed unused dependencies and assets: `react`, `react-dom`, `extract-zip`, `@types/react`, `@types/react-dom`, `@types/lodash`, and unused status icons.
- Added a `justfile` as the project command surface.
- Fixed package license metadata to match the Apache-2.0 upstream license.
- Added fork attribution and unofficial GitHub Copilot integration notice.
- Changed the Obsidian plugin id to `github-copilot-autocomplete` to avoid upstream update collisions.
- Reworked GitHub Copilot sign-in to use the official language-server device flow: `signIn` plus `workspace/executeCommand`.

## 1.3.0

- Removed Copilot Chat from the Obsidian plugin surface.
- Moved Copilot sign-in into plugin settings.
- Added arrow-first inline completion controls.
- Kept optional secondary hotkeys for custom workflows.
