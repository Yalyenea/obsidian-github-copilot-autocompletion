# Obsidian GitHub Copilot Autocomplete

A narrow Obsidian fork for GitHub Copilot inline autocompletion.

This fork removes Copilot Chat and keeps only the editor-native completion path: start the Copilot language server, sync the current Markdown document, render ghost text, and accept suggestions with arrow-first controls.

## Scope

- Inline Copilot suggestions in Markdown editors
- GitHub Copilot sign-in and sign-out from plugin settings
- Node.js 22+ language-server runtime
- Path exclusions, manual-only mode, code-block-only mode, proxy, and extra CA certificates
- Status-bar toggle and minimal settings UI

Not included: chat, conversation history, model selection, prompt settings, markdown rendering, or React-based plugin UI.

## Requirements

- Obsidian desktop
- A GitHub Copilot subscription
- Node.js 22 or later
- Network access to GitHub Copilot

## Installation

Copy the release files into:

```text
.obsidian/plugins/github-copilot-autocomplete/
```

Required files:

- `manifest.json`
- `main.js`
- `styles.css`

Keep the folder name aligned with the manifest id: `github-copilot-autocomplete`. This avoids collisions with the upstream `github-copilot` plugin and prevents Obsidian from treating this fork as the original plugin.

## Setup

1. Open Obsidian settings for `GitHub Copilot Autocomplete`.
2. Set the Node.js binary path, for example `/opt/homebrew/bin/node`.
3. Click `Test`.
4. Click `Sign in`.
5. If a device-code modal appears, enter the code on GitHub (the plugin opens the browser and copies the code). Use `I authorized GitHub, check status` if needed.
6. If local Copilot credentials already exist, status should flip to `Signed in` without a browser step.
7. Reload the plugin (or Obsidian) after updating `main.js` if the settings UI was already open.

## Controls

- `Right Arrow`: accept full suggestion
- `Alt-Right`: accept next word
- `Alt-ArrowDown`: next suggestion
- `Alt-ArrowUp`: previous suggestion
- `Escape`: dismiss suggestion

Optional hotkeys in settings are secondary bindings. `Tab` is intentionally not the primary accept key, so Obsidian indentation and LaTeX Suite snippets can keep their normal behavior.

## Development

Use `just` as the command surface:

```bash
just install
just check
just dev
```

Useful recipes:

- `just check`: type-check, build production `main.js`, and run tests
- `just test`: unit + language-server integration tests
- `just build`: build production `main.js`
- `just dev`: watch build
- `just release`: check then list release files

## Release Files

The Obsidian plugin release contains only:

- `main.js`
- `manifest.json`
- `styles.css`

## License And Attribution

This repository is a fork of [Pierrad/obsidian-github-copilot](https://github.com/Pierrad/obsidian-github-copilot). The upstream project is licensed under Apache-2.0; this fork keeps the same license. See [LICENCE.md](LICENCE.md) and [NOTICE.md](NOTICE.md).

GitHub Copilot is a GitHub product. This plugin is an unofficial Obsidian integration and is not endorsed by GitHub.
