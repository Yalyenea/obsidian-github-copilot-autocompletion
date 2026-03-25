# Release Notes Draft

Suggested next version: `1.3.0`

## Summary

This fork refocuses the plugin on one thing: GitHub Copilot inline autocompletion in Obsidian.

Chat has been removed. The interaction model has been rebuilt around inline ghost text that works better inside real Obsidian editing workflows, especially when `Tab` is already occupied by core editor behavior or plugins such as LaTeX Suite.

## Highlights

- Removed Copilot Chat and all related UI, settings, and dependencies
- Moved Copilot sign-in into the plugin settings
- Changed the default interaction model away from `Tab`
- Added built-in inline actions:
  - `Right Arrow` accepts the full suggestion
  - `Alt-Right` accepts the next word
  - `Alt-ArrowDown` and `Alt-ArrowUp` cycle suggestions
  - `Escape` dismisses suggestions
- Improved ghost text behavior so matching typed prefixes keep the suggestion alive instead of clearing it immediately
- Tightened plugin scope and reduced runtime/dependency surface

## Breaking Changes

- Copilot Chat is no longer included in this fork
- The primary completion flow is no longer designed around `Tab`
- Existing users who previously relied on old accept or partial-accept hotkeys may want to review settings after upgrading

## Migration Notes

- The plugin id remains `github-copilot`, so existing installs, settings, and local sign-in state can be reused
- The display name is now `GitHub Copilot Autocomplete`
- Optional hotkeys remain available as secondary shortcuts, but the built-in arrow-based inline actions are now the primary workflow

## Recommended Release Title

`Autocomplete-only fork with editor-style inline completion`
