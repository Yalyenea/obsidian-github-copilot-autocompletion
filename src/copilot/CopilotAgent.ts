import { ChildProcessWithoutNullStreams, spawn } from "child_process";
import * as path from "path";
import { Notice } from "obsidian";
import { EditorView } from "@codemirror/view";

import CopilotPlugin from "../main";
import { SettingsObserver } from "../settings/CopilotPluginSettingTab";
import Vault from "../helpers/Vault";
import Logger from "../helpers/Logger";
import File from "../helpers/File";
import Client from "./Client";
import {
	AuthStatus,
	mapCheckStatus,
	mapStatusNotification,
	StatusPayload,
} from "./authStatus";
import { GetCompletionsParams } from "@pierrad/ts-lsp-client";
import { InlineSuggestionEffect } from "../extensions/InlineSuggestionState";

class CopilotAgent implements SettingsObserver {
	private plugin: CopilotPlugin;
	private client: Client | null = null;
	private agent: ChildProcessWithoutNullStreams | null = null;
	private agentPath: string;
	private authenticationStatus: AuthStatus = "unknown";
	private setupPromise: Promise<void> | null = null;
	private intentionalStop = false;

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
		return (
			!!this.agent &&
			!!this.client &&
			!this.agent.killed &&
			this.agent.exitCode === null
		);
	}

	public setAuthenticationStatus(status: AuthStatus) {
		this.authenticationStatus = status;
	}

	public applyStatusNotification(payload: StatusPayload): void {
		const next = mapStatusNotification(payload);
		if (next) {
			this.authenticationStatus = next;
		}
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

	public isSignedIn(): boolean {
		return this.authenticationStatus === "signedIn";
	}

	public getClient(): Client {
		if (!this.client) {
			new Notice("Copilot is not ready yet! Please check your settings.");
			throw new Error("Copilot client is not ready");
		}
		return this.client;
	}

	public async setup(): Promise<void> {
		if (this.setupPromise) {
			return this.setupPromise;
		}

		this.setupPromise = this.doSetup().finally(() => {
			this.setupPromise = null;
		});
		return this.setupPromise;
	}

	private async doSetup(): Promise<void> {
		const wasReady = this.isReady();
		await this.stopAgent();

		if (!File.doesFileExist(this.plugin.settings.nodePath)) {
			throw new Error(
				`Node.js binary not found: ${this.plugin.settings.nodePath}`,
			);
		}
		if (!File.doesFileExist(this.agentPath)) {
			throw new Error(
				`Copilot language server not found: ${this.agentPath}. Reload the plugin to re-download it.`,
			);
		}

		this.startAgent();
		if (!this.agent) {
			throw new Error("Failed to start Copilot language server process.");
		}

		await this.configureClient();
		await this.refreshAuthenticationStatus();
		if (!wasReady) {
			new Notice("Copilot is ready!");
		}
	}

	public startAgent(): void {
		try {
			this.intentionalStop = false;
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

			// Spawn Node directly (no shell). shell:true left orphan language-server
			// processes that kept stdout pipes broken after reload.
			this.agent = spawn(
				this.plugin.settings.nodePath,
				[this.agentPath, "--stdio"],
				{
					stdio: "pipe",
					env,
				},
			);

			this.agent.stderr.on("data", (data) => {
				Logger.getInstance().error(`stderr: ${data}`);
			});

			this.agent.on("error", (error) => {
				Logger.getInstance().error("Agent process error: " + error);
				if (!this.intentionalStop) {
					new Notice("Error starting Copilot agent: " + error);
				}
				this.markAgentStopped();
			});

			this.agent.on("exit", (code) => {
				Logger.getInstance().log(
					`child process exited with code ${code}`,
				);
				const unexpected = !this.intentionalStop;
				this.markAgentStopped();
				if (unexpected) {
					new Notice("Copilot has stopped.");
				}
			});
		} catch (error) {
			new Notice("Error starting agent: " + error);
			this.agent = null;
		}
	}

	private markAgentStopped(): void {
		this.authenticationStatus = "unknown";
		if (this.client) {
			try {
				this.client.dispose();
			} catch {
				// ignore
			}
			this.client = null;
		}
		this.agent = null;
	}

	public async refreshAuthenticationStatus(): Promise<void> {
		try {
			const res = (await this.getClient().checkStatus()) as StatusPayload;
			this.authenticationStatus = mapCheckStatus(res);
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
		const agent = this.agent;
		const client = this.client;
		this.intentionalStop = true;
		this.client = null;
		this.agent = null;
		this.authenticationStatus = "unknown";

		if (client) {
			try {
				client.dispose();
			} catch {
				// ignore
			}
		}

		if (agent && agent.exitCode === null && !agent.killed) {
			try {
				agent.kill("SIGTERM");
			} catch {
				// ignore
			}
			// Hard-kill if the process ignores SIGTERM.
			setTimeout(() => {
				if (agent.exitCode === null && !agent.killed) {
					try {
						agent.kill("SIGKILL");
					} catch {
						// ignore
					}
				}
			}, 1000);
		}

		// Allow unexpected-exit notices again after this stop settles.
		setTimeout(() => {
			this.intentionalStop = false;
		}, 1500);

		return Promise.resolve();
	}

	public async triggerCompletions(
		view: EditorView,
		params: GetCompletionsParams,
	): Promise<void> {
		if (!this.isReady()) {
			return;
		}

		this.plugin.statusBar?.updateElement(true);
		try {
			const res = await this.getClient().completion(params);
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
		} finally {
			this.plugin.statusBar?.updateElement();
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
