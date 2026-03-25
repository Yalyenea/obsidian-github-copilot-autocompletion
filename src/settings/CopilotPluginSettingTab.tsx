import { App, Notice, PluginSettingTab, Setting, debounce } from "obsidian";
import { StrictMode } from "react";
import { Root, createRoot } from "react-dom/client";

import CopilotPlugin from "../main";
import AuthModal from "../modal/AuthModal";
import KeybindingInput from "../components/KeybindingInput";
import AutocompleteInput from "../components/AutocompleteInput";
import Node from "../helpers/Node";
import Logger from "../helpers/Logger";
import File from "../helpers/File";
import Json from "../helpers/Json";
import Vault from "../helpers/Vault";

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
	deviceSpecificSettings: string[];
	useDeviceSpecificSettings: boolean;
	proxy: string;
	extraCACerts?: string;
}

const DEFAULT_ACCEPT_HOTKEY =
	typeof navigator !== "undefined" && navigator.platform.includes("Mac")
		? "Cmd-Enter"
		: "Ctrl-Enter";
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
	deviceSpecificSettings: ["nodePath"],
	useDeviceSpecificSettings: false,
	proxy: "",
	extraCACerts: "",
};

class CopilotPluginSettingTab extends PluginSettingTab {
	plugin: CopilotPlugin;
	private observers: SettingsObserver[] = [];
	root: Root | null = null;

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
			.setDesc(
				"Enable or disable the inline copilot. This will also start the copilot server.",
			)
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
			.setDesc(
				"The path to your node binary (at least Node v22). This is used to run the copilot server.",
			)
			.addText((text) =>
				text
					.setPlaceholder("Enter the path to your node binary.")
					.setValue(this.plugin.settings.nodePath)
					.onChange(
						debounce(
							async (value) => {
								this.plugin.settings.nodePath = value;
								await this.saveSettings();
							},
							1000,
							true,
						),
					),
			)
			.addButton((button) =>
				button
					.setButtonText("Test the path")
					.setTooltip(
						"This will test the path and verify the version of node.",
					)
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
			.setName("Suggestions delay")
			.setDesc(
				"The delay in milliseconds before generating suggestions. Default is 500ms.",
			)
			.addText((text) => {
				text.inputEl.type = "number";
				return text
					.setPlaceholder("Enter the delay in milliseconds.")
					.setValue(this.plugin.settings.suggestionDelay.toString())
					.onChange(
						debounce(
							async (value) => {
								this.plugin.settings.suggestionDelay =
									parseInt(value);
								await this.saveSettings();
							},
							1000,
							true,
						),
					);
			});

		this.root = createRoot(
			containerEl.createEl("div", {
				cls: "copilot-settings-hotkeys-container",
			}),
		);

		const bindings = [
			{
				title: "Optional accept hotkey",
				description:
					`Optional secondary keybinding to accept Copilot suggestions. ${BUILT_IN_ACCEPT_HINT} is always available and is the default primary accept action.`,
				value: this.plugin.settings.hotkeys.accept,
				onChange: (value: string) => {
					this.plugin.settings.hotkeys.accept = value;
				},
				defaultValue: DEFAULT_SETTINGS.hotkeys.accept,
				placeholder: BUILT_IN_ACCEPT_HINT,
			},
			{
				title: "Cancel suggestion",
				description: "Keybinding to cancel copilot suggestions.",
				value: this.plugin.settings.hotkeys.cancel,
				onChange: (value: string) => {
					this.plugin.settings.hotkeys.cancel = value;
				},
				defaultValue: DEFAULT_SETTINGS.hotkeys.cancel,
			},
			{
				title: "Request suggestion",
				description: "Keybinding to request copilot suggestions.",
				value: this.plugin.settings.hotkeys.request,
				onChange: (value: string) => {
					this.plugin.settings.hotkeys.request = value;
				},
				defaultValue: DEFAULT_SETTINGS.hotkeys.request,
			},
			{
				title: "Optional partial accept hotkey",
				description:
					`Optional secondary keybinding to accept suggestions word by word. ${BUILT_IN_PARTIAL_ACCEPT_HINT} is always available.`,
				value: this.plugin.settings.hotkeys.partial,
				onChange: (value: string) => {
					this.plugin.settings.hotkeys.partial = value;
				},
				defaultValue: DEFAULT_SETTINGS.hotkeys.partial,
				placeholder: BUILT_IN_PARTIAL_ACCEPT_HINT,
			},
			{
				title: "Optional next suggestion hotkey",
				description:
					"Optional secondary keybinding to move to the next suggestion if multiple are available.",
				value: this.plugin.settings.hotkeys.next,
				onChange: (value: string) => {
					this.plugin.settings.hotkeys.next = value;
				},
				defaultValue: DEFAULT_SETTINGS.hotkeys.next,
				placeholder: "Alt-ArrowDown",
			},
			{
				title: "Enable/Disable Copilot",
				description:
					"Keybinding to enable or disable copilot suggestions.",
				value: this.plugin.settings.hotkeys.disable,
				onChange: (value: string) => {
					this.plugin.settings.hotkeys.disable = value;
				},
				defaultValue: DEFAULT_SETTINGS.hotkeys.disable,
			},
		];

		this.root.render(
			<StrictMode>
				<h3>Keybindings</h3>
				<p className="copilot-settings-note">
					The built-in inline actions are Right Arrow to accept,
					Alt-Right to accept the next word, Alt-ArrowDown to cycle
					forward through suggestions, Alt-ArrowUp to cycle
					backward, and Escape to dismiss. Leave the optional fields
					blank unless you want extra shortcuts on top of that.
				</p>
				{bindings.map((binding, index) => (
					<KeybindingInput
						key={index}
						title={binding.title}
						description={binding.description}
						value={binding.value}
						onChange={binding.onChange}
						defaultValue={binding.defaultValue}
						placeholder={binding.placeholder}
					/>
				))}
				<button
					className="mod-cta copilot-settings-save-button"
					onClick={() => {
						this.saveSettings().then(() => {
							this.plugin.app.workspace.updateOptions();
						});
					}}
				>
					Save keybindings
				</button>
				<h3>Exclude folders and files</h3>
				<AutocompleteInput
					title="Exclude"
					description="Folders and files to exclude from suggestions."
					values={this.plugin.settings.exclude}
					plugin={this.plugin}
					onSave={(values: string[]) => {
						this.plugin.settings.exclude = values;
						this.saveSettings().then(() => {
							this.plugin.app.workspace.updateOptions();
						});
					}}
				/>
			</StrictMode>,
		);

		new Setting(containerEl)
			.setName("Only on keybinding")
			.setDesc(
				"Only show suggestions when the 'request' keybinding is pressed. Default is false.",
			)
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
			.setDesc(
				"Only show suggestions when the cursor is inside a code block. Default is false.",
			)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.onlyInCodeBlock)
					.onChange(async (value) => {
						this.plugin.settings.onlyInCodeBlock = value;
						await this.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("Use device-specific settings")
			.setDesc(
				"If enabled, certain settings (only the node path for now) will be saved to a separate file. This is useful when using the same vault on multiple devices. Default is false.",
			)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.useDeviceSpecificSettings)
					.onChange(async (value) => {
						this.plugin.settings.useDeviceSpecificSettings = value;
						await this.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("Setup proxy")
			.setDesc(
				"Set up a proxy for the copilot service. Should start with http:// or https://.",
			)
			.addText((text) =>
				text
					.setPlaceholder("Enter the proxy URL.")
					.setValue(this.plugin.settings.proxy)
					.onChange(
						debounce(
							async (value) => {
								this.plugin.settings.proxy = value;
								await this.saveSettings();
							},
							1000,
							true,
						),
					),
			);

		new Setting(containerEl)
			.setName("Root certificates (NODE_EXTRA_CA_CERTS)")
			.setDesc(
				"Path to a PEM file containing additional root certificates. This will be set as NODE_EXTRA_CA_CERTS for the Copilot agent. Leave blank to use system defaults.",
			)
			.addText((text) =>
				text
					.setPlaceholder("C:/path/to/cacert.pem")
					.setValue(this.plugin.settings.extraCACerts || "")
					.onChange(
						debounce(
							async (value) => {
								this.plugin.settings.extraCACerts = value;
								await this.saveSettings();
							},
							1000,
							true,
						),
					),
			);

		new Setting(containerEl)
			.setName("Enable debug mode")
			.setDesc(
				"Enable logging for debugging purposes. Logs are written to the console.",
			)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.debug)
					.onChange(async (value) => {
						this.plugin.settings.debug = value;
						Logger.getInstance().setDebug(value);
						await this.saveSettings();
					}),
			);

		new Setting(containerEl).setName("Copilot Account").setHeading();

		containerEl.createEl("p", {
			text: `Manage GitHub Copilot sign-in here. Current status: ${this.plugin.copilotAgent?.getAuthenticationStatusLabel() || "Unknown"}.`,
			cls: "copilot-settings-note",
		});

		new Setting(containerEl)
			.addButton((button) =>
				button
					.setButtonText("Sign in to Copilot")
					.setTooltip(
						"This will start the Copilot service in the background if needed.",
					)
					.onClick(async () => {
						await this.initSignIn();
					}),
			)
			.addButton((button) =>
				button
					.setButtonText("Sign out")
					.setTooltip(
						"This will start the Copilot service in the background if needed.",
					)
					.setWarning()
					.onClick(async () => {
						await this.signOut();
					}),
			);
	}

	public hide(): void {
		if (this.root) {
			this.root.unmount();
			this.root = null;
		}
	}

	public async loadSettings() {
		const loadedData = (await this.plugin.loadData()) || {};
		const legacySettings = { ...loadedData };
		delete legacySettings.chatSettings;
		delete legacySettings.systemPrompt;
		delete legacySettings.invertEnterSendBehavior;
		delete legacySettings.enableMarkdownRendering;
		delete legacySettings.openChatOnStartup;

		if (legacySettings.hotkeys) {
			if (
				[DEFAULT_ACCEPT_HOTKEY, "Cmd-Enter", "Ctrl-Enter"].includes(
					legacySettings.hotkeys.accept,
				)
			) {
				legacySettings.hotkeys.accept = "";
			}

			if (legacySettings.hotkeys.partial === "Cmd-Shift-.") {
				legacySettings.hotkeys.partial = "";
			}

			if (legacySettings.hotkeys.next === "Cmd-Shift-ArrowDown") {
				legacySettings.hotkeys.next = "";
			}
		}

		const defaultSettings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			legacySettings,
		);
		if (defaultSettings.useDeviceSpecificSettings) {
			this.plugin.settings = Object.assign(
				{},
				defaultSettings,
				Json.textToJsonObject(
					File.readFileSync(
						Vault.getPluginPath(this.plugin.app) +
							"/device_data.json",
					),
				) || {},
			);
		} else {
			this.plugin.settings = defaultSettings;
		}
	}

	public async saveSettings(
		notify = true,
		notice = true,
	): Promise<void | void[]> {
		if (this.plugin.settings.useDeviceSpecificSettings) {
			File.writeFileSync(
				Vault.getPluginPath(this.plugin.app) + "/device_data.json",
				Json.jsonObjectToText(
					Json.onlyKeepProperties(
						this.plugin.settings,
						this.plugin.settings.deviceSpecificSettings,
					),
				),
			);
		}
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
					if (path) {
						this.plugin.settings.nodePathUpdatedToNode20 = true;
						this.plugin.settings.nodePathUpdatedToNode22 = true;
						await this.saveSettings(false, false);
					}
					return true;
				},
			))
		);
	}

	private async ensureCopilotAgentReady(): Promise<boolean> {
		if (!this.plugin.settings.enabled) {
			this.plugin.settings.enabled = true;
			await this.saveSettings(true, false);
		}

		if (!(await this.isCopilotEnabledWithPathCheck())) {
			new Notice(
				"Configure a valid Node.js 22+ path in the plugin settings before signing in to Copilot.",
			);
			return false;
		}

		if (!this.plugin.copilotAgent.isReady()) {
			await this.plugin.copilotAgent.setup();
		}

		return true;
	}

	private async initSignIn() {
		if (!(await this.ensureCopilotAgentReady())) {
			return;
		}

		await this.plugin.copilotAgent
			.getClient()
			.initiateSignIn()
			.then((res) => {
				if (res.status === "AlreadySignedIn") {
					this.plugin.copilotAgent.setAuthenticationStatus(
						"signedIn",
					);
					new Notice("You are already signed in.");
					this.display();
				} else {
					new AuthModal(
						this.plugin,
						res.userCode,
						res.verificationUri,
					).open();
				}
			});
	}

	private async signOut() {
		if (!(await this.ensureCopilotAgentReady())) {
			return;
		}

		await this.plugin.copilotAgent
			.getClient()
			.signOut()
			.then(() => {
				this.plugin.copilotAgent.setAuthenticationStatus("signedOut");
				new Notice("Signed out successfully.");
				this.display();
			});
	}

	public registerObserver(observer: SettingsObserver) {
		this.observers.push(observer);
	}

	private notifyObservers(): Promise<void[]> {
		return Promise.all(
			this.observers.map((observer) => observer.onSettingsUpdate()),
		);
	}
}

export default CopilotPluginSettingTab;
