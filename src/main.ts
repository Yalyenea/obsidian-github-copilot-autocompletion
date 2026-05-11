import { Notice, Plugin } from "obsidian";

import EventManager from "./events/EventManager";
import CopilotAgent from "./copilot/CopilotAgent";
import StatusBar from "./status/StatusBar";
import CopilotPluginSettingTab, {
	CopilotPluginSettings,
	DEFAULT_SETTINGS,
} from "./settings/CopilotPluginSettingTab";
import ExtensionManager from "./extensions/ExtensionManager";
import Vault from "./helpers/Vault";
import File from "./helpers/File";
import Logger from "./helpers/Logger";
import Cacher from "./copilot/Cacher";
import github from "./config/github";

export default class CopilotPlugin extends Plugin {
	settingsTab: CopilotPluginSettingTab;
	settings: CopilotPluginSettings;
	statusBar: StatusBar | null;
	copilotAgent: CopilotAgent;
	private cmExtensionManager: ExtensionManager;
	private eventManager: EventManager;
	version = "1.434.0";
	tabSize = Vault.DEFAULT_TAB_SIZE;

	async onload() {
		this.settingsTab = new CopilotPluginSettingTab(this.app, this);
		this.addSettingTab(this.settingsTab);
		await this.settingsTab.loadSettings();

		this.statusBar = new StatusBar(this);

		Logger.getInstance().setDebug(this.settings.debug);

		this.tabSize = Vault.getTabSize(this.app);

		await this.ensureLanguageServerInstalled();

		if (
			this.settings.nodePath === DEFAULT_SETTINGS.nodePath ||
			this.settings.nodePath === ""
		) {
			new Notice(
				"[GitHub Copilot] Please set the path to your node executable in the settings to use autocomplete feature.",
			);
		}

		if (
			this.settingsTab.isCopilotEnabled() &&
			!this.settings.nodePathUpdatedToNode22
		) {
			new Notice(
				"[GitHub Copilot] Copilot has changed the minimum node version to 22. Please update your node version if you are using an older version.",
			);
		}

		this.copilotAgent = new CopilotAgent(this);
		if (await this.settingsTab.isCopilotEnabledWithPathCheck()) {
			await this.copilotAgent.setup();
		}

		this.eventManager = new EventManager(this);
		this.eventManager.registerEvents();

		this.cmExtensionManager = new ExtensionManager(this);
		this.registerEditorExtension(this.cmExtensionManager.getExtensions());

		const file = this.app.workspace.getActiveFile();
		if (file) {
			Cacher.getInstance().setCurrentFilePath(
				Vault.getBasePath(this.app),
				file.path,
			);
		}

	}

	onunload() {
		this.copilotAgent?.stopAgent();
		this.statusBar = null;
	}

	private async ensureLanguageServerInstalled() {
		const agentPath = Vault.getAgentPath(this.app, this.version);
		const copilotPath = Vault.getCopilotPath(this.app, this.version);
		const zipPath = `${copilotPath}.zip`;

		if (File.doesFileExist(agentPath)) {
			return;
		}

		await File.createFolder(copilotPath);

		await new Promise<void>((resolve) => {
			File.downloadFile(github.RELEASE_URL(this.version), zipPath, (err) => {
				if (err) {
					Logger.getInstance().log(`Download failed: ${err}`);
					new Notice(
						"[GitHub Copilot] Failed to download the Copilot language server. Remove the empty copilot folder or retry later.",
					);
					resolve();
					return;
				}

				Logger.getInstance().log("Download finished.");
				File.unzipFile(zipPath, copilotPath);
				File.removeFile(zipPath);
				resolve();
			});
		});

		File.removeOldCopilotFolders(
			this.version,
			Vault.getPluginPath(this.app),
		);
	}
}
