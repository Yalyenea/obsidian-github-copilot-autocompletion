import { EditorView, keymap } from "@codemirror/view";

import { Prec } from "@codemirror/state";
import {
	acceptSuggestion,
	cancelSuggestion,
	InlineSuggestion,
	inlineSuggestionField,
	nextSuggestion,
	offsetToPos,
	partialAcceptSuggestion,
	previousSuggestion,
} from "./InlineSuggestionState";
import { Hotkeys } from "../settings/CopilotPluginSettingTab";
import Cacher from "../copilot/Cacher";
import CopilotAgent from "../copilot/CopilotAgent";
import FileUri from "../helpers/FileUri";
import LSP from "../helpers/LSP";
import CopilotPlugin from "../main";

type ParsedHotkey = {
	key: string;
	alt: boolean;
	ctrl: boolean;
	meta: boolean;
	shift: boolean;
};

const CODE_TO_KEY: Record<string, string> = {
	Enter: "enter",
	NumpadEnter: "enter",
	Escape: "escape",
	Space: " ",
	ArrowUp: "arrowup",
	ArrowDown: "arrowdown",
	ArrowLeft: "arrowleft",
	ArrowRight: "arrowright",
	Slash: "/",
	Period: ".",
	Comma: ",",
	Minus: "-",
	Equal: "=",
	Semicolon: ";",
	Quote: "'",
	BracketLeft: "[",
	BracketRight: "]",
	Backslash: "\\",
	Backquote: "`",
	Tab: "tab",
};

const KEY_ALIASES: Record<string, string> = {
	esc: "escape",
	escape: "escape",
	enter: "enter",
	return: "enter",
	tab: "tab",
	space: " ",
	spacebar: " ",
	up: "arrowup",
	down: "arrowdown",
	left: "arrowleft",
	right: "arrowright",
	arrowup: "arrowup",
	arrowdown: "arrowdown",
	arrowleft: "arrowleft",
	arrowright: "arrowright",
	slash: "/",
	period: ".",
	comma: ",",
};

function normalizeHotkeyKeyToken(token: string): string {
	if (!token) {
		return "";
	}

	const lowered = token.toLowerCase();
	if (KEY_ALIASES[lowered]) {
		return KEY_ALIASES[lowered];
	}

	return token.length === 1 ? lowered : lowered;
}

function parseHotkey(hotkey: string): ParsedHotkey | null {
	if (!hotkey?.trim()) {
		return null;
	}

	const tokens = hotkey.split(/-(?!$)/).filter(Boolean);
	if (!tokens.length) {
		return null;
	}

	const parsed: ParsedHotkey = {
		key: "",
		alt: false,
		ctrl: false,
		meta: false,
		shift: false,
	};

	for (const token of tokens.slice(0, -1)) {
		const lowered = token.toLowerCase();

		if (["alt", "a"].includes(lowered)) {
			parsed.alt = true;
			continue;
		}

		if (["ctrl", "control", "c"].includes(lowered)) {
			parsed.ctrl = true;
			continue;
		}

		if (["cmd", "meta", "m"].includes(lowered)) {
			parsed.meta = true;
			continue;
		}

		if (lowered === "mod") {
			if (navigator.platform.includes("Mac")) {
				parsed.meta = true;
			} else {
				parsed.ctrl = true;
			}
			continue;
		}

		if (["shift", "s"].includes(lowered)) {
			parsed.shift = true;
		}
	}

	parsed.key = normalizeHotkeyKeyToken(tokens[tokens.length - 1]);
	return parsed.key ? parsed : null;
}

function normalizeEventKey(event: KeyboardEvent): string {
	const code = CODE_TO_KEY[event.code];
	if (code) {
		return code;
	}

	if (/^Key[A-Z]$/.test(event.code)) {
		return event.code.slice(3).toLowerCase();
	}

	if (/^Digit[0-9]$/.test(event.code)) {
		return event.code.slice(5);
	}

	return normalizeHotkeyKeyToken(event.key);
}

function matchesHotkey(event: KeyboardEvent, hotkey: string): boolean {
	const parsed = parseHotkey(hotkey);
	if (!parsed) {
		return false;
	}

	return (
		parsed.key === normalizeEventKey(event) &&
		parsed.alt === event.altKey &&
		parsed.ctrl === event.ctrlKey &&
		parsed.meta === event.metaKey &&
		parsed.shift === event.shiftKey
	);
}

function getSuggestion(view: EditorView): InlineSuggestion | null {
	return view.state.field(inlineSuggestionField);
}

function hasVisibleSuggestion(view: EditorView): boolean {
	const suggestion = getSuggestion(view);
	return !!suggestion?.suggestions?.length;
}

function shouldAcceptWithArrowRight(
	view: EditorView,
	event: KeyboardEvent,
): boolean {
	if (
		event.key !== "ArrowRight" ||
		event.altKey ||
		event.ctrlKey ||
		event.metaKey ||
		event.shiftKey
	) {
		return false;
	}

	if (!hasVisibleSuggestion(view)) {
		return false;
	}

	const selection = view.state.selection.main;
	return selection.empty;
}

function shouldPartialAcceptWithAltRight(
	view: EditorView,
	event: KeyboardEvent,
): boolean {
	if (
		event.key !== "ArrowRight" ||
		!event.altKey ||
		event.ctrlKey ||
		event.metaKey ||
		event.shiftKey
	) {
		return false;
	}

	return hasVisibleSuggestion(view) && view.state.selection.main.empty;
}

function shouldCycleForwardSuggestion(
	view: EditorView,
	event: KeyboardEvent,
): boolean {
	if (
		event.key !== "ArrowDown" ||
		!event.altKey ||
		event.ctrlKey ||
		event.metaKey ||
		event.shiftKey
	) {
		return false;
	}

	return hasVisibleSuggestion(view);
}

function shouldCycleBackwardSuggestion(
	view: EditorView,
	event: KeyboardEvent,
): boolean {
	if (
		event.key !== "ArrowUp" ||
		!event.altKey ||
		event.ctrlKey ||
		event.metaKey ||
		event.shiftKey
	) {
		return false;
	}

	return hasVisibleSuggestion(view);
}

function requestSuggestion(
	view: EditorView,
	agent: CopilotAgent,
	plugin: CopilotPlugin,
): void {
	const current = Cacher.getInstance().getCurrentFilePath();
	const fileUri = FileUri.fromVaultPath(current.basePath, current.filePath);
	const didChangeParams = LSP.createDidChangeParams({
		uri: fileUri,
		version: Cacher.getInstance().getCache(current.filePath),
		text: view.state.doc.toString(),
	});

	agent
		.getClient()
		.didChange(didChangeParams)
		.then(() => {
			const cursor = offsetToPos(
				view.state.doc,
				view.state.selection.main.head,
			);
			const completionParams = LSP.createCompletionParams({
				uri: fileUri,
				relativePath: current.filePath,
				line: cursor.line,
				character: cursor.ch,
				version: Cacher.getInstance().getCache(current.filePath),
				indentSize: plugin.tabSize,
			});

			agent.triggerCompletions(view, completionParams);
		});
}

export const inlineSuggestionKeyWatcher = (
	hotkeys: Hotkeys,
	agent: CopilotAgent,
	plugin: CopilotPlugin,
) =>
	Prec.highest(
		keymap.of(
			[
				{
					any: (view: EditorView, event: KeyboardEvent) => {
						if (shouldAcceptWithArrowRight(view, event)) {
							acceptSuggestion(view);
							return true;
						}

						if (shouldPartialAcceptWithAltRight(view, event)) {
							partialAcceptSuggestion(view);
							return true;
						}

						if (shouldCycleForwardSuggestion(view, event)) {
							nextSuggestion(view);
							return true;
						}

						if (shouldCycleBackwardSuggestion(view, event)) {
							previousSuggestion(view);
							return true;
						}

						if (
							hotkeys.accept &&
							matchesHotkey(event, hotkeys.accept) &&
							hasVisibleSuggestion(view)
						) {
							acceptSuggestion(view);
							return true;
						}

						if (
							hotkeys.cancel &&
							matchesHotkey(event, hotkeys.cancel) &&
							hasVisibleSuggestion(view)
						) {
							cancelSuggestion(view);
							return true;
						}

						if (
							hotkeys.partial &&
							matchesHotkey(event, hotkeys.partial) &&
							hasVisibleSuggestion(view)
						) {
							partialAcceptSuggestion(view);
							return true;
						}

						if (
							hotkeys.next &&
							matchesHotkey(event, hotkeys.next) &&
							hasVisibleSuggestion(view)
						) {
							nextSuggestion(view);
							return true;
						}

						if (
							hotkeys.request &&
							matchesHotkey(event, hotkeys.request)
						) {
							requestSuggestion(view, agent, plugin);
							return true;
						}

						if (
							hotkeys.disable &&
							matchesHotkey(event, hotkeys.disable)
						) {
							plugin.settings.enabled =
								!plugin.settingsTab.isCopilotEnabled();
							plugin.settingsTab.saveSettings(true, false);
							return true;
						}

						return false;
					},
				},
				hotkeys.accept
					? {
							key: hotkeys.accept,
							run: (view: EditorView) => {
								if (hasVisibleSuggestion(view)) {
									acceptSuggestion(view);
									return true;
								}
								return false;
							},
						}
					: null,
				hotkeys.cancel
					? {
							key: hotkeys.cancel,
							run: (view: EditorView) => {
								if (hasVisibleSuggestion(view)) {
									cancelSuggestion(view);
									return true;
								}
								return false;
							},
						}
					: null,
				hotkeys.request
					? {
							key: hotkeys.request,
							run: (view: EditorView) => {
								requestSuggestion(view, agent, plugin);
								return true;
							},
						}
					: null,
				hotkeys.partial
					? {
							key: hotkeys.partial,
							run: (view: EditorView) => {
								if (hasVisibleSuggestion(view)) {
									partialAcceptSuggestion(view);
									return true;
								}
								return false;
							},
						}
					: null,
				hotkeys.next
					? {
							key: hotkeys.next,
							run: (view: EditorView) => {
								if (hasVisibleSuggestion(view)) {
									nextSuggestion(view);
									return true;
								}
								return false;
							},
						}
					: null,
				hotkeys.disable
					? {
							key: hotkeys.disable,
							run: () => {
								plugin.settings.enabled =
									!plugin.settingsTab.isCopilotEnabled();
								plugin.settingsTab.saveSettings(true, false);
								return true;
							},
						}
					: null,
			].filter((binding): binding is NonNullable<typeof binding> =>
				Boolean(binding),
			),
		),
	);
