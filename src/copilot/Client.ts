/* eslint-disable @typescript-eslint/no-explicit-any */
import {
	LspClient,
	InitializeParams,
	InitializeResult,
	DidOpenTextDocumentParams,
	DidChangeTextDocumentParams,
	GetCompletionsParams,
	CompletionList,
} from "@pierrad/ts-lsp-client";
import { Notice } from "obsidian";
import Cacher from "./Cacher";
import CopilotPlugin from "../main";
import Vault from "../helpers/Vault";
import FileUri from "../helpers/FileUri";
import Logger from "../helpers/Logger";
import SafeJsonRpcEndpoint from "./SafeJsonRpcEndpoint";
import LSP from "../helpers/LSP";

export type CopilotResponse = {
	jsonrpc: string;
	id: number;
	result: any;
};

export type CopilotCommand = {
	command: string;
	title?: string;
	arguments?: unknown[];
};

export type CopilotSignInResponse = {
	status?: string;
	user?: string;
	userCode?: string;
	verificationUri?: string;
	expiresIn?: number;
	interval?: number;
	command?: CopilotCommand;
	error?: {
		message?: string;
	};
};

class Client {
	private plugin: CopilotPlugin;
	private endpoint: SafeJsonRpcEndpoint;
	private client: LspClient;
	private basePath: string;

	constructor(plugin: CopilotPlugin) {
		this.plugin = plugin;
		this.basePath = Vault.getBasePath(this.plugin.app);
		this.endpoint = new SafeJsonRpcEndpoint(
			this.plugin.copilotAgent.getAgent().stdin,
			this.plugin.copilotAgent.getAgent().stdout,
		);
		this.setupListeners();
		// LspClient only needs send/notify; SafeJsonRpcEndpoint is API-compatible.
		this.client = new LspClient(this.endpoint as any);
	}

	public setupListeners(): void {
		this.endpoint.on("error", (error) => {
			Logger.getInstance().error("Error in JSONRPC endpoint: " + error);
		});

		this.endpoint.on(
			"window/showDocument",
			async (
				params: { uri?: string; external?: boolean } | undefined,
				respond?: (result: unknown) => void,
			) => {
				const uri = params?.uri;
				if (!uri) {
					respond?.({ success: false });
					return;
				}
				const ok = await this.openExternalUrl(uri);
				respond?.({ success: ok });
			},
		);

		this.endpoint.on(
			"window/showMessageRequest",
			(
				params: { message?: string } | undefined,
				respond?: (result: unknown) => void,
			) => {
				if (params?.message) {
					new Notice(params.message);
				}
				respond?.(null);
			},
		);

		this.endpoint.on(
			"window/logMessage",
			(params: { message?: string } | undefined) => {
				if (params?.message) {
					Logger.getInstance().log(params.message);
				}
			},
		);

		this.endpoint.on(
			"workspace/configuration",
			(
				params: { items?: Array<{ section?: string }> } | undefined,
				respond?: (result: unknown) => void,
			) => {
				const items = params?.items || [];
				respond?.(
					items.map((item) => this.configurationForSection(item.section)),
				);
			},
		);

		const onStatus = (params: unknown) => {
			this.plugin.copilotAgent.applyStatusNotification(
				params as {
					status?: string;
					kind?: string;
					message?: string;
				},
			);
		};
		this.endpoint.on("didChangeStatus", onStatus);
		this.endpoint.on("statusNotification", onStatus);
	}

	private configurationForSection(section?: string): Record<string, unknown> {
		if (section === "http") {
			return {
				proxy: this.plugin.settings.proxy || "",
				proxyStrictSSL: true,
			};
		}
		if (section === "telemetry") {
			return {
				telemetryLevel: "off",
			};
		}
		if (section === "github-enterprise") {
			return {
				uri: "",
			};
		}
		return {};
	}

	public async openExternalUrl(url: string): Promise<boolean> {
		if (!this.isAllowedExternalUrl(url)) {
			Logger.getInstance().error(
				"Blocked external URL open (not an allowed GitHub HTTPS URL): " +
					url,
			);
			return false;
		}

		try {
			// Prefer Electron shell when available inside Obsidian.
			// eslint-disable-next-line @typescript-eslint/no-var-requires
			const electron = require("electron");
			const shell = electron?.shell ?? electron?.remote?.shell;
			if (shell?.openExternal) {
				await shell.openExternal(url);
				return true;
			}
		} catch {
			// Fall through to window.open.
		}

		try {
			window.open(url);
			return true;
		} catch (error) {
			Logger.getInstance().error("Failed to open URL: " + error);
			return false;
		}
	}

	private isAllowedExternalUrl(url: string): boolean {
		try {
			const parsed = new URL(url);
			if (parsed.protocol !== "https:") {
				return false;
			}
			const host = parsed.hostname.toLowerCase();
			return (
				host === "github.com" ||
				host.endsWith(".github.com") ||
				host === "githubusercontent.com" ||
				host.endsWith(".githubusercontent.com")
			);
		} catch {
			return false;
		}
	}

	public async setup(): Promise<void> {
		const rootUri = FileUri.fromAbsolutePath(this.basePath);
		await this.initialize({
			processId: this.plugin.copilotAgent.getAgent().pid as number,
			capabilities: {
				workspace: {
					workspaceFolders: true,
					configuration: true,
					executeCommand: {
						dynamicRegistration: true,
					},
				} as any,
				window: {
					// Enable LS-driven browser open during device flow.
					showDocument: {
						support: true,
					},
				} as any,
			},
			clientInfo: {
				name: "ObsidianCopilot",
				version: "0.0.1",
			},
			rootUri,
			workspaceFolders: [
				{
					name: "Obsidian",
					uri: rootUri,
				},
			],
			initializationOptions: {
				editorInfo: {
					name: "obsidian",
					version: "0.0.1",
				},
				editorPluginInfo: {
					name: "obsidian-copilot",
					version: "0.0.1",
				},
			},
		});
		await this.initialized();
		await this.pushConfiguration();
		await this.checkStatus();
		await this.setEditorInfo();
	}

	private async initialize(
		params: InitializeParams,
	): Promise<InitializeResult> {
		return await this.client.initialize(params);
	}

	private async initialized(): Promise<void> {
		await this.client.initialized();
	}

	private async pushConfiguration(): Promise<void> {
		// LSP defines this as a client -> server notification, not a request.
		this.endpoint.notify("workspace/didChangeConfiguration", {
			settings: {
				http: this.configurationForSection("http"),
				telemetry: this.configurationForSection("telemetry"),
			},
		});
	}

	public async checkStatus(): Promise<any> {
		return this.client.customRequest("checkStatus", {
			localChecksOnly: false,
		});
	}

	public async setEditorInfo(): Promise<void> {
		await this.client.customRequest("setEditorInfo", {
			editorInfo: {
				name: "obsidian",
				version: "0.0.1",
			},
			editorPluginInfo: {
				name: "obsidian-copilot",
				version: "0.0.1",
			},
		});

		const activeFile = this.plugin.app.workspace.getActiveFile();
		if (activeFile) {
			const content = await this.plugin.app.vault.read(activeFile);
			const didOpenParams = LSP.createDidOpenParams({
				uri: FileUri.fromVaultPath(this.basePath, activeFile.path),
				version: Cacher.getInstance().getCache(activeFile.path || ""),
				text: content,
			});
			await this.openDocument(didOpenParams);
		}
	}

	public async signIn(): Promise<CopilotSignInResponse> {
		return (await this.client.customRequest(
			"signIn",
			{},
		)) as CopilotSignInResponse;
	}

	public async executeCommand(command: CopilotCommand): Promise<unknown> {
		// Device flow can wait up to ~15 minutes for browser authorization.
		const timeoutMs =
			command.command === "github.copilot.finishDeviceFlow"
				? 15 * 60 * 1000
				: 30_000;
		return await this.endpoint.send(
			"workspace/executeCommand",
			{
				command: command.command,
				arguments: command.arguments || [],
			},
			timeoutMs,
		);
	}

	public async signOut(): Promise<void> {
		return await this.client.customRequest("signOut", {});
	}

	public async openDocument(
		params: DidOpenTextDocumentParams,
	): Promise<void> {
		try {
			await this.client.didOpen(params);
		} catch (error) {
			Logger.getInstance().error("Error in openDocument: " + error);
		}
	}

	public async didChange(params: DidChangeTextDocumentParams): Promise<void> {
		try {
			await this.client.didChange(params);
		} catch (error) {
			Logger.getInstance().error("Error in didChange: " + error);
		}
	}

	public async completion(
		params: GetCompletionsParams,
	): Promise<CompletionList> {
		try {
			return (await this.client.customRequest(
				"textDocument/inlineCompletion",
				params,
			)) as CompletionList;
		} catch (error) {
			Logger.getInstance().error("Error in completion: " + error);
			return {
				items: [],
			};
		}
	}

	public dispose(): void {
		try {
			this.client.exit();
		} catch {
			// Process may already be gone.
		}
		this.endpoint.dispose();
	}
}

export default Client;
