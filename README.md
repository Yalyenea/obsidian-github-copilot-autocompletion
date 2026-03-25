# Obsidian GitHub Copilot Autocomplete

An Obsidian plugin fork focused on one job: GitHub Copilot inline autocompletion.

This fork removes chat and keeps the plugin centered on editor-native completion, with input behavior tuned for Obsidian writing flows and plugins such as LaTeX Suite.

## What Changed In This Fork

- Removed Copilot Chat and related UI, settings, and dependencies
- Kept GitHub Copilot sign-in inside the plugin settings
- Switched the primary accept flow away from `Tab`
- Added editor-style inline actions:
  - `Right Arrow` accepts the full suggestion
  - `Alt-Right` accepts the next word
  - `Alt-ArrowDown` and `Alt-ArrowUp` cycle through multiple suggestions
  - `Escape` dismisses the suggestion
- Preserved optional secondary hotkeys for users who still want custom bindings

## Why

In Obsidian, `Tab` is already overloaded by core editor behavior and community plugins. The most obvious conflict is formula editing with LaTeX Suite, where stealing `Tab` makes completion feel worse, not better.

This fork treats inline completion as ghost text first, shortcut-driven second.

## Requirements

- Obsidian desktop
- A GitHub Copilot subscription
- Node.js 22 or later
- Network access to GitHub Copilot

## Installation

### Community plugin style install

1. Copy the plugin into your vault under:
   `.obsidian/plugins/github-copilot`
2. Make sure these files exist:
   - `manifest.json`
   - `main.js`
   - `styles.css`
3. Enable the plugin in Obsidian.

> If you install manually, keep the plugin folder name as `github-copilot`, because the current manifest id is still `github-copilot`.

## First-Time Setup

1. Open the plugin settings in Obsidian.
2. Set your Node.js binary path.
   - Example on macOS with Homebrew: `/opt/homebrew/bin/node`
3. Click `Test the path`.
4. Click `Sign in to Copilot`.

If you already signed in through another Copilot client on the same machine, the plugin may detect that and skip the full device-code flow.

## Inline Completion Behavior

The built-in interaction model is:

- `Right Arrow`: accept the visible suggestion
- `Alt-Right`: accept the next word
- `Alt-ArrowDown`: next suggestion
- `Alt-ArrowUp`: previous suggestion
- `Escape`: dismiss the suggestion

When you continue typing characters that match the current suggestion prefix, the ghost text stays alive and shrinks forward instead of disappearing immediately.

This is the default experience. Optional hotkeys in settings are secondary shortcuts layered on top.

## Settings

The plugin keeps a small settings surface:

- Enable or disable Copilot
- Node binary path
- Suggestion delay
- Manual-only completion mode
- Code-block-only completion mode
- Excluded files and folders
- Proxy and extra CA certificates
- Optional secondary hotkeys
- Sign in and sign out

## LaTeX Suite Compatibility

This fork is intentionally designed to avoid using `Tab` as the primary accept key.

That means:

- LaTeX Suite can keep using `Tab` for snippet expansion
- Obsidian can keep its normal indentation and editor behavior
- Copilot completion remains available through arrow-based inline actions

If you want to bind accept back to `Tab`, you still can, but that reintroduces the same collision this fork is trying to avoid.

## Development

```bash
npm install
npm run build
```

Useful scripts:

- `npm run dev`: rebuild in watch mode
- `npm run build`: type-check and build production output

## Project Scope

This fork is intentionally narrow.

It is not trying to be a full Copilot surface inside Obsidian. The goal is to make inline completion feel predictable, lightweight, and compatible with real note-taking workflows.

## Credits

- Original project: [Pierrad/obsidian-github-copilot](https://github.com/Pierrad/obsidian-github-copilot)
- This repository is a fork focused on autocomplete-only behavior
