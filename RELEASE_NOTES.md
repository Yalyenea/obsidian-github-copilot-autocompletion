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

- The plugin id remains `github-copilot`, so existing installs, settings, and local sign-in state can still be reused
- The display name is now `GitHub Copilot Autocomplete`
- Built-in arrow-based inline actions are now the primary interaction model
