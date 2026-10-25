# v1.3.1

## Summary

This release fixes Copilot sign-in and language-server lifecycle handling, and simplifies the Obsidian settings interface.

## Changes

- Fixed stalled sign-in, reused existing credentials, and surfaced startup failures
- Fixed JSON-RPC response matching, added request timeouts, and cleaned up language-server processes on shutdown
- Fixed Homebrew Node symlink detection and file URIs containing spaces or non-ASCII characters
- Updated the Copilot language server to `1.520.0` and synchronized configuration and authentication notifications
- Fixed workspace event cleanup and completion error handling
- Removed remaining chat-only CSS, Cursor rules, issue/demo assets, and repository metadata
- Replaced the React settings components with native Obsidian settings controls
- Removed unused runtime and type dependencies
- Added `just` recipes for install, build, check, dev, and release checks
- Fixed the package license field to Apache-2.0 and added fork attribution in `NOTICE.md`
- Updated release workflow and issue templates for the autocomplete-only fork
- Changed the plugin id to `github-copilot-autocomplete` so Obsidian updates cannot collide with the upstream plugin

## Upgrade

- The plugin ID changed from `github-copilot` to `github-copilot-autocomplete`. Install this release in `.obsidian/plugins/github-copilot-autocomplete` and disable the old plugin to avoid duplicate completions.
- Download `main.js`, `manifest.json`, and `styles.css` from the release assets into that directory, then reload Obsidian and enable GitHub Copilot Autocomplete.

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
