import { App, Notice, PluginSettingTab, Setting, debounce } from "obsidian";

import CopilotPlugin from "../main";
import AuthModal from "../modal/AuthModal";
import Node from "../helpers/Node";
import Logger from "../helpers/Logger";

export interface SettingsObserver {
	onSettingsUpdate(): Promise<void>;
}

export type Hotkeys = {
	accept: string;
	cancel: string;
	request: string;
	partial: string;
	next: string;
	disable: string;
};

export interface CopilotPluginSettings {
	nodePath: string;
	nodePathUpdatedToNode20: boolean;
	nodePathUpdatedToNode22: boolean;
	enabled: boolean;
	hotkeys: Hotkeys;
	suggestionDelay: number;
	debug: boolean;
	onlyOnHotkey: boolean;
	onlyInCodeBlock: boolean;
	exclude: string[];
	proxy: string;
	extraCACerts: string;
}

const BUILT_IN_ACCEPT_HINT = "Right Arrow";
const BUILT_IN_PARTIAL_ACCEPT_HINT = "Alt-Right";

export const DEFAULT_SETTINGS: CopilotPluginSettings = {
	nodePath: "default",
	nodePathUpdatedToNode20: false,
	nodePathUpdatedToNode22: false,
	enabled: true,
	hotkeys: {
		accept: "",
		cancel: "Escape",
		request: "Cmd-Shift-/",
		partial: "",
		next: "",
		disable: "Cmd-Shift-ArrowRight",
	},
	suggestionDelay: 500,
	debug: false,
	onlyOnHotkey: false,
	onlyInCodeBlock: false,
	exclude: [],
	proxy: "",
	extraCACerts: "",
};

type LoadedSettings = Partial<CopilotPluginSettings> & {
	hotkeys?: Partial<Hotkeys>;
};

class CopilotPluginSettingTab extends PluginSettingTab {
	plugin: CopilotPlugin;
	private observers: SettingsObserver[] = [];

	constructor(app: App, plugin: CopilotPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName("Inline Copilot Settings")
			.setHeading();

		new Setting(containerEl)
			.setName("Enable Copilot")
			.setDesc("Start the Copilot language server and show suggestions.")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.enabled)
					.onChange(async (value) => {
						this.plugin.settings.enabled = value;
						await this.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("Node binary path")
			.setDesc("Absolute path to Node.js 22 or later.")
			.addText((text) =>
				text
					.setPlaceholder("/opt/homebrew/bin/node")
					.setValue(this.plugin.settings.nodePath)
					.onChange(
						debounce(
							async (value) => {
								this.plugin.settings.nodePath = value.trim();
								await this.saveSettings();
							},
							1000,
							true,
						),
					),
			)
			.addButton((button) =>
				button
					.setButtonText("Test")
					.setTooltip("Verify the configured Node.js binary.")
					.onClick(async () => {
						const path = await Node.testNodePath(
							this.plugin.settings.nodePath,
						);
						if (path) {
							this.plugin.settings.nodePath = path;
							await this.saveSettings();
						}
					}),
			);

		new Setting(containerEl)
			.setName("Suggestion delay")
			.setDesc("Debounce delay before requesting inline suggestions.")
			.addText((text) => {
				text.inputEl.type = "number";
				return text
					.setPlaceholder("500")
					.setValue(this.plugin.settings.suggestionDelay.toString())
					.onChange(
						debounce(
							async (value) => {
								const delay = Number.parseInt(value, 10);
								if (Number.isFinite(delay)) {
									this.plugin.settings.suggestionDelay =
										delay;
									await this.saveSettings();
								}
							},
							1000,
							true,
						),
					);
			});

		new Setting(containerEl)
			.setName("Only on keybinding")
			.setDesc("Request suggestions only through the request hotkey.")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.onlyOnHotkey)
					.onChange(async (value) => {
						this.plugin.settings.onlyOnHotkey = value;
						await this.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("Only in code block")
			.setDesc("Request suggestions only inside fenced code blocks.")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.onlyInCodeBlock)
					.onChange(async (value) => {
						this.plugin.settings.onlyInCodeBlock = value;
						await this.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("Excluded files and folders")
			.setDesc("One path fragment per line. Matching files are skipped.")
			.addTextArea((text) => {
				text.inputEl.addClass("copilot-settings-textarea");
				return text
					.setPlaceholder("archive/\ntemplates/draft.md")
					.setValue(this.plugin.settings.exclude.join("\n"))
					.onChange(
						debounce(
							async (value) => {
								this.plugin.settings.exclude = value
									.split("\n")
									.map((item) => item.trim())
									.filter(Boolean);
								await this.saveSettings();
							},
							1000,
							true,
						),
					);
			});

		new Setting(containerEl)
			.setName("Proxy")
			.setDesc("Optional HTTP or HTTPS proxy for the Copilot service.")
			.addText((text) =>
				text
					.setPlaceholder("https://127.0.0.1:7890")
					.setValue(this.plugin.settings.proxy)
					.onChange(
						debounce(
							async (value) => {
								this.plugin.settings.proxy = value.trim();
								await this.saveSettings();
							},
							1000,
							true,
						),
					),
			);

		new Setting(containerEl)
			.setName("Root certificates")
			.setDesc("Optional PEM file path passed as NODE_EXTRA_CA_CERTS.")
			.addText((text) =>
				text
					.setPlaceholder("/path/to/cacert.pem")
					.setValue(this.plugin.settings.extraCACerts)
					.onChange(
						debounce(
							async (value) => {
								this.plugin.settings.extraCACerts =
									value.trim();
								await this.saveSettings();
							},
							1000,
							true,
						),
					),
			);

		new Setting(containerEl)
			.setName("Debug logging")
			.setDesc("Write Copilot runtime logs to the developer console.")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.debug)
					.onChange(async (value) => {
						this.plugin.settings.debug = value;
						Logger.getInstance().setDebug(value);
						await this.saveSettings();
					}),
			);

		this.renderHotkeySettings(containerEl);
		this.renderAccountSettings(containerEl);
	}

	public async loadSettings(): Promise<void> {
		this.plugin.settings = this.normalizeSettings(
			((await this.plugin.loadData()) || {}) as LoadedSettings,
		);
	}

	public async saveSettings(
		notify = true,
		notice = true,
	): Promise<void | void[]> {
		this.plugin.settings = this.normalizeSettings(this.plugin.settings);
		await this.plugin.saveData(this.plugin.settings);
		await this.loadSettings();
		if (notice) new Notice("Settings saved successfully.");
		if (notify) return this.notifyObservers();
		return Promise.resolve();
	}

	public isCopilotEnabled(): boolean {
		return (
			this.plugin.settings.enabled &&
			this.plugin.settings.nodePath !== "" &&
			this.plugin.settings.nodePath !== DEFAULT_SETTINGS.nodePath
		);
	}

	public async isCopilotEnabledWithPathCheck(): Promise<boolean> {
		return (
			this.isCopilotEnabled() &&
			(await Node.testNodePath(this.plugin.settings.nodePath, true).then(
				async (path) => {
					if (!path) return false;
					this.plugin.settings.nodePathUpdatedToNode20 = true;
					this.plugin.settings.nodePathUpdatedToNode22 = true;
					await this.saveSettings(false, false);
					return true;
				},
			))
		);
	}

	public registerObserver(observer: SettingsObserver): void {
		this.observers.push(observer);
	}

	private renderHotkeySettings(containerEl: HTMLElement): void {
		new Setting(containerEl).setName("Keybindings").setHeading();
		containerEl.createEl("p", {
			cls: "copilot-settings-note",
			text: "Built-in actions: Right Arrow accepts, Alt-Right accepts one word, Alt-ArrowDown/Alt-ArrowUp cycle suggestions, Escape dismisses. Optional fields add secondary shortcuts.",
		});

		this.addHotkeySetting(containerEl, {
			key: "accept",
			name: "Optional accept hotkey",
			desc: `${BUILT_IN_ACCEPT_HINT} is always available as the primary accept action.`,
			placeholder: BUILT_IN_ACCEPT_HINT,
		});
		this.addHotkeySetting(containerEl, {
			key: "cancel",
			name: "Cancel suggestion",
			desc: "Dismiss the visible inline suggestion.",
		});
		this.addHotkeySetting(containerEl, {
			key: "request",
			name: "Request suggestion",
			desc: "Request a suggestion at the current cursor.",
		});
		this.addHotkeySetting(containerEl, {
			key: "partial",
			name: "Optional partial accept hotkey",
			desc: `${BUILT_IN_PARTIAL_ACCEPT_HINT} is always available for word-by-word acceptance.`,
			placeholder: BUILT_IN_PARTIAL_ACCEPT_HINT,
		});
		this.addHotkeySetting(containerEl, {
			key: "next",
			name: "Optional next suggestion hotkey",
			desc: "Move to the next visible suggestion.",
			placeholder: "Alt-ArrowDown",
		});
		this.addHotkeySetting(containerEl, {
			key: "disable",
			name: "Enable or disable Copilot",
			desc: "Toggle inline suggestions without opening settings.",
		});

		new Setting(containerEl).addButton((button) =>
			button
				.setButtonText("Save keybindings")
				.setCta()
				.onClick(async () => {
					await this.saveSettings();
					this.display();
				}),
		);
	}

	private addHotkeySetting(
		containerEl: HTMLElement,
		options: {
			key: keyof Hotkeys;
			name: string;
			desc: string;
			placeholder?: string;
		},
	): void {
		new Setting(containerEl)
			.setName(options.name)
			.setDesc(options.desc)
			.addText((text) =>
				text
					.setPlaceholder(options.placeholder || "")
					.setValue(this.plugin.settings.hotkeys[options.key])
					.onChange((value) => {
						this.plugin.settings.hotkeys[options.key] =
							value.trim();
					}),
			)
			.addButton((button) =>
				button.setButtonText("Clear").onClick(async () => {
					this.plugin.settings.hotkeys[options.key] = "";
					await this.saveSettings();
					this.display();
				}),
			)
			.addButton((button) =>
				button.setButtonText("Reset").onClick(async () => {
					this.plugin.settings.hotkeys[options.key] =
						DEFAULT_SETTINGS.hotkeys[options.key];
					await this.saveSettings();
					this.display();
				}),
			);
	}

	private renderAccountSettings(containerEl: HTMLElement): void {
		new Setting(containerEl).setName("Copilot Account").setHeading();

		containerEl.createEl("p", {
			text: `Current status: ${this.plugin.copilotAgent?.getAuthenticationStatusLabel() || "Unknown"}.`,
			cls: "copilot-settings-note",
		});

		new Setting(containerEl)
			.addButton((button) =>
				button
					.setButtonText("Sign in")
					.setTooltip("Start the Copilot service if needed.")
					.onClick(async () => {
						await this.initSignIn();
					}),
			)
			.addButton((button) =>
				button
					.setButtonText("Sign out")
					.setTooltip("Start the Copilot service if needed.")
					.setWarning()
					.onClick(async () => {
						await this.signOut();
					}),
			);
	}

	private normalizeSettings(settings: LoadedSettings): CopilotPluginSettings {
		return {
			nodePath: settings.nodePath ?? DEFAULT_SETTINGS.nodePath,
			nodePathUpdatedToNode20:
				settings.nodePathUpdatedToNode20 ??
				DEFAULT_SETTINGS.nodePathUpdatedToNode20,
			nodePathUpdatedToNode22:
				settings.nodePathUpdatedToNode22 ??
				DEFAULT_SETTINGS.nodePathUpdatedToNode22,
			enabled: settings.enabled ?? DEFAULT_SETTINGS.enabled,
			hotkeys: {
				...DEFAULT_SETTINGS.hotkeys,
				...(settings.hotkeys || {}),
			},
			suggestionDelay:
				settings.suggestionDelay ?? DEFAULT_SETTINGS.suggestionDelay,
			debug: settings.debug ?? DEFAULT_SETTINGS.debug,
			onlyOnHotkey:
				settings.onlyOnHotkey ?? DEFAULT_SETTINGS.onlyOnHotkey,
			onlyInCodeBlock:
				settings.onlyInCodeBlock ?? DEFAULT_SETTINGS.onlyInCodeBlock,
			exclude: Array.isArray(settings.exclude) ? settings.exclude : [],
			proxy: settings.proxy ?? DEFAULT_SETTINGS.proxy,
			extraCACerts:
				settings.extraCACerts ?? DEFAULT_SETTINGS.extraCACerts,
		};
	}

	private async ensureCopilotAgentReady(): Promise<boolean> {
		if (!this.plugin.copilotAgent) {
			new Notice("Copilot is still starting. Try signing in again shortly.");
			return false;
		}

		if (!this.plugin.settings.enabled) {
			this.plugin.settings.enabled = true;
			await this.saveSettings(true, false);
		}

		if (!(await this.isCopilotEnabledWithPathCheck())) {
			new Notice(
				"Configure a valid Node.js 22+ path before signing in to Copilot.",
			);
			return false;
		}

		if (!this.plugin.copilotAgent.isReady()) {
			new Notice("Starting Copilot service...");
			try {
				await this.plugin.copilotAgent.setup();
			} catch (error) {
				Logger.getInstance().error(
					"Failed to start Copilot service: " + error,
				);
				new Notice("Failed to start Copilot service: " + error);
				return false;
			}
		}

		if (!this.plugin.copilotAgent.isReady()) {
			new Notice(
				"Copilot service is not ready. Check the Node.js path and developer console.",
			);
			return false;
		}

		return true;
	}

	private async initSignIn(): Promise<void> {
		new Notice("Starting Copilot sign-in...");
		if (!(await this.ensureCopilotAgentReady())) {
			return;
		}

		try {
			// Prefer already-valid local credentials before opening a device flow.
			await this.plugin.copilotAgent.refreshAuthenticationStatus();
			if (this.plugin.copilotAgent.isSignedIn()) {
				new Notice("You are already signed in.");
				this.display();
				return;
			}

			const res = await this.plugin.copilotAgent.getClient().signIn();

			if (res.status === "AlreadySignedIn" || res.status === "OK") {
				this.plugin.copilotAgent.setAuthenticationStatus("signedIn");
				new Notice(
					res.user
						? `Signed in as ${res.user}.`
						: "You are already signed in.",
				);
				this.display();
				return;
			}

			if (!res.userCode || !res.command) {
				Logger.getInstance().error(
					"Unexpected Copilot sign-in response: " +
						JSON.stringify(res),
				);
				new Notice("Copilot did not return a sign-in device flow.");
				return;
			}

			this.plugin.copilotAgent.setAuthenticationStatus("signedOut");
			new AuthModal(
				this.plugin,
				res.userCode,
				res.command,
				res.verificationUri,
			).open();
		} catch (error) {
			Logger.getInstance().error("Failed to start Copilot sign-in: " + error);
			new Notice("Failed to start Copilot sign-in: " + error);
		}
	}

	private async signOut(): Promise<void> {
		if (!(await this.ensureCopilotAgentReady())) {
			return;
		}

		try {
			await this.plugin.copilotAgent.getClient().signOut();
			this.plugin.copilotAgent.setAuthenticationStatus("signedOut");
			new Notice("Signed out successfully.");
			this.display();
		} catch (error) {
			Logger.getInstance().error("Failed to sign out of Copilot: " + error);
			new Notice("Failed to sign out of Copilot: " + error);
		}
	}

	private notifyObservers(): Promise<void[]> {
		return Promise.all(
			this.observers.map((observer) => observer.onSettingsUpdate()),
		);
	}
}

export default CopilotPluginSettingTab;
