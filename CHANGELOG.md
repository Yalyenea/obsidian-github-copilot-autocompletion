# Changelog

## Unreleased

- Removed remaining Copilot Chat styles, rules, demo assets, and metadata.
- Rebuilt the settings tab with Obsidian native controls and removed React from the runtime dependency surface.
- Removed unused dependencies and assets: `react`, `react-dom`, `extract-zip`, `@types/react`, `@types/react-dom`, `@types/lodash`, and unused status icons.
- Added a `justfile` as the project command surface.
- Fixed package license metadata to match the Apache-2.0 upstream license.
- Added fork attribution and unofficial GitHub Copilot integration notice.
- Changed the Obsidian plugin id to `github-copilot-autocomplete` to avoid upstream update collisions.

## 1.3.0

- Removed Copilot Chat from the Obsidian plugin surface.
- Moved Copilot sign-in into plugin settings.
- Added arrow-first inline completion controls.
- Kept optional secondary hotkeys for custom workflows.
