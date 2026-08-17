import {
	Debouncer,
	Editor,
	EventRef,
	MarkdownFileInfo,
	MarkdownView,
	TFile,
	debounce,
} from "obsidian";

import CopilotPlugin from "../main";
import EventListener from "./EventListener";
import { SettingsObserver } from "../settings/CopilotPluginSettingTab";
import Vault from "../helpers/Vault";

class EventManager implements SettingsObserver {
	private plugin: CopilotPlugin;
	private eventListener: EventListener;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	private debouncedEditorChangeHandler: Debouncer<any, any> | null = null;
	private eventRefs: EventRef[] = [];
	private unloadRegistered = false;

	private fileOpenHandler = async (file: TFile | null): Promise<void> => {
		if (this.canRegisterEvent(file)) {
			await this.eventListener.onFileOpen(file);
		}
	};

	constructor(plugin: CopilotPlugin) {
		this.plugin = plugin;
		this.eventListener = new EventListener(this.plugin);
		this.plugin.settingsTab.registerObserver(this);
	}

	public registerEvents(): void {
		// Ensure plugin unload always detaches our dynamic listeners once.
		if (!this.unloadRegistered) {
			this.plugin.register(() => this.unRegisterEvents());
			this.unloadRegistered = true;
		}

		this.unRegisterEvents();

		this.eventRefs.push(
			this.plugin.app.workspace.on("file-open", this.fileOpenHandler),
		);

		if (this.plugin.settings.onlyOnHotkey) {
			return;
		}

		this.debouncedEditorChangeHandler = debounce(
			async (editor: Editor, info: MarkdownView | MarkdownFileInfo) => {
				if (this.canRegisterEvent(info?.file as TFile)) {
					await this.eventListener.onEditorChange(editor, info);
				}
			},
			this.plugin.settings.suggestionDelay,
			true,
		);

		this.eventRefs.push(
			this.plugin.app.workspace.on(
				"editor-change",
				this.debouncedEditorChangeHandler,
			),
		);
	}

	public unRegisterEvents(): void {
		for (const ref of this.eventRefs) {
			this.plugin.app.workspace.offref(ref);
		}
		this.eventRefs = [];
		this.debouncedEditorChangeHandler = null;
	}

	// Hot path: do not re-spawn Node to re-test the binary on every keystroke.
	// Agent readiness already implies a successful path check + setup.
	private canRegisterEvent(file: TFile | null): boolean {
		return (
			this.plugin.settingsTab.isCopilotEnabled() &&
			!!this.plugin.copilotAgent?.isReady() &&
			!Vault.isFileExcluded(
				file?.path as string,
				this.plugin.settings.exclude,
			)
		);
	}

	onSettingsUpdate(): Promise<void> {
		this.registerEvents();
		return Promise.resolve();
	}
}
export default EventManager;
