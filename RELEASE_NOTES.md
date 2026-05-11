# Unreleased

## Summary

This cleanup tightens the fork around its only intended job: GitHub Copilot inline autocompletion in Obsidian.

## Changes

- Removed remaining chat-only CSS, Cursor rules, issue/demo assets, and repository metadata
- Replaced the React settings components with native Obsidian settings controls
- Removed unused runtime and type dependencies
- Added `just` recipes for install, build, check, dev, and release checks
- Fixed the package license field to Apache-2.0 and added fork attribution in `NOTICE.md`
- Updated release workflow and issue templates for the autocomplete-only fork
- Changed the plugin id to `github-copilot-autocomplete` so Obsidian updates cannot collide with the upstream plugin

## Validation

- Run `just check` before publishing a release
- Release artifacts remain `main.js`, `manifest.json`, and `styles.css`

# v1.3.0

## Summary

This release turns the fork into an autocomplete-only Obsidian plugin focused on GitHub Copilot inline completion.

Chat has been removed. The completion flow has been rebuilt around ghost text and arrow-driven acceptance so it behaves better inside real Obsidian writing workflows, especially when `Tab` is already reserved by editor behavior or plugins such as LaTeX Suite.

## Highlights

- Removed Copilot Chat and all related UI, settings, and dependencies
- Moved Copilot sign-in into the plugin settings
- Added built-in inline actions:
  - `Right Arrow` accepts the full suggestion
  - `Alt-Right` accepts the next word
  - `Alt-ArrowDown` and `Alt-ArrowUp` cycle suggestions
  - `Escape` dismisses suggestions
- Kept optional secondary hotkeys for users who still want custom shortcuts
- Improved ghost text behavior so matching typed prefixes keep the suggestion alive instead of clearing it immediately
- Tightened the plugin scope and reduced the runtime/dependency surface

## Breaking Changes

- Copilot Chat is no longer part of this fork
- The primary completion flow is no longer designed around `Tab`
- Users upgrading from older builds may want to review their configured hotkeys

## Migration Notes

- The plugin id is now `github-copilot-autocomplete`, so install it under `.obsidian/plugins/github-copilot-autocomplete`
- The display name is now `GitHub Copilot Autocomplete`
- Built-in arrow-based inline actions are now the primary interaction model
