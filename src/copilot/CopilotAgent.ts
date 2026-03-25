import { ChildProcessWithoutNullStreams, spawn } from "child_process";
import * as path from "path";
import { Notice } from "obsidian";
import { EditorView } from "@codemirror/view";

import CopilotPlugin from "../main";
import { SettingsObserver } from "../settings/CopilotPluginSettingTab";
import Vault from "../helpers/Vault";
import Logger from "../helpers/Logger";
import Json from "../helpers/Json";
import Client, { CopilotResponse } from "./Client";
import File from "../helpers/File";
import { GetCompletionsParams } from "@pierrad/ts-lsp-client";
import { InlineSuggestionEffect } from "../extensions/InlineSuggestionState";

class CopilotAgent implements SettingsObserver {
	private plugin: CopilotPlugin;
	private client: Client | null = null;
	private agent: ChildProcessWithoutNullStreams | null = null;
	private agentPath: string;
	private authenticationStatus: "unknown" | "signedIn" | "signedOut" =
		"unknown";

	constructor(plugin: CopilotPlugin) {
		this.plugin = plugin;
		this.agentPath = path.join(
			Vault.getAgentPath(this.plugin.app, this.plugin.version),
		);
		this.plugin.settingsTab.registerObserver(this);
	}

	public getAgent(): ChildProcessWithoutNullStreams {
		return this.agent as ChildProcessWithoutNullStreams;
	}

	public isReady(): boolean {
		return !!this.agent && !!this.client;
	}

	public setAuthenticationStatus(status: "unknown" | "signedIn" | "signedOut") {
		this.authenticationStatus = status;
	}

	public getAuthenticationStatusLabel(): string {
		switch (this.authenticationStatus) {
			case "signedIn":
				return "Signed in";
			case "signedOut":
				return "Signed out";
			default:
				return "Unknown";
		}
	}

	public getClient(): Client {
		if (!this.client) {
			new Notice("Copilot is not ready yet! Please check your settings.");
		}
		return this.client as Client;
	}

	public async setup(): Promise<void> {
		const wasReady = this.isReady();
		await this.stopAgent();
		this.startAgent();
		this.setupListeners();
		await this.configureClient();
		await this.refreshAuthenticationStatus();
		if (!wasReady) {
			new Notice("Copilot is ready!");
		}
		return Promise.resolve();
	}

	public startAgent(): void {
		try {
			const env = {
				...process.env,
				...(this.plugin.settings.proxy.startsWith("http://")
					? { HTTP_PROXY: this.plugin.settings.proxy }
					: {}),
				...(this.plugin.settings.proxy.startsWith("https://")
					? { HTTPS_PROXY: this.plugin.settings.proxy }
					: {}),
				...(this.plugin.settings.extraCACerts &&
				this.plugin.settings.extraCACerts.trim() !== ""
					? {
							NODE_EXTRA_CA_CERTS:
								this.plugin.settings.extraCACerts.trim(),
						}
					: {}),
			};

			this.agent = spawn(
				File.wrapFilePath(this.plugin.settings.nodePath),
				[File.wrapFilePath(this.agentPath), "--stdio"],
				{
					shell: true,
					stdio: "pipe",
					env,
				},
			);
		} catch (error) {
			new Notice("Error starting agent: " + error);
		}
	}

	public async refreshAuthenticationStatus(): Promise<void> {
		try {
			const res = await this.getClient().checkStatus();
			const status =
				typeof res?.status === "string"
					? res.status
					: typeof res?.result?.status === "string"
						? res.result.status
						: null;

			if (status === "OK" || status === "AlreadySignedIn") {
				this.authenticationStatus = "signedIn";
			} else if (status === "NotSignedIn") {
				this.authenticationStatus = "signedOut";
			} else {
				this.authenticationStatus = "unknown";
			}
		} catch (error) {
			Logger.getInstance().log(
				`Failed to refresh authentication status: ${error}`,
			);
			this.authenticationStatus = "unknown";
		}
	}

	public async configureClient() {
		this.client = new Client(this.plugin);
		await this.client.setup();
	}

	public stopAgent(): Promise<void> {
		if (this.client) {
			this.client.dispose();
			this.client = null;
		}
		if (this.agent) {
			this.agent.kill();
			this.agent = null;
		}
		return Promise.resolve();
	}

	public setupListeners(): void {
		this.getAgent().stdout.on("data", (data) => {
			Logger.getInstance().log(`stdout: ${data}`);
			if (data.toString().includes("NotSignedIn")) {
				this.authenticationStatus = "signedOut";
				const jsonObjects = Json.splitJsonObjects(data.toString());
				for (const jsonObjectString of jsonObjects) {
					const json = Json.extractJsonObject(
						jsonObjectString,
					) as CopilotResponse;
					if (json?.result?.status === "NotSignedIn") {
						break;
					}
				}
			} else if (data.toString().includes("DocumentVersionMismatch")) {
				Logger.getInstance().log("DocumentVersionMismatch");
			}
		});

		this.getAgent().stderr.on("data", (data) => {
			Logger.getInstance().error(`stderr: ${data}`);
		});

		this.getAgent().on("exit", (code) => {
			Logger.getInstance().log(`child process exited with code ${code}`);
			this.authenticationStatus = "unknown";
			new Notice("Copilot has stopped.");
		});
	}

	public async triggerCompletions(
		view: EditorView,
		params: GetCompletionsParams,
	): Promise<void> {
		this.plugin.statusBar?.updateElement(true);
		const res = await this.getClient().completion(params);
		this.plugin.statusBar?.updateElement();

		if (res && res.items && res.items.length > 0) {
			const completions = res.items.map((c) => ({
				insertText: c.insertText,
				range: c.range,
			}));
			view.dispatch({
				effects: [
					InlineSuggestionEffect.of({
						suggestions: completions,
						index: 0,
					}),
				],
			});
		}
	}

	async onSettingsUpdate(): Promise<void> {
		if (await this.plugin.settingsTab.isCopilotEnabledWithPathCheck())
			return this.setup();
		this.authenticationStatus = "unknown";
		return this.stopAgent();
	}
}

export default CopilotAgent;
