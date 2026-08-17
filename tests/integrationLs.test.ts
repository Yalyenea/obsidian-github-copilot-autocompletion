import * as assert from "assert";
import { spawn } from "child_process";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import FileUri from "../src/helpers/FileUri";
import SafeJsonRpcEndpoint from "../src/copilot/SafeJsonRpcEndpoint";
import { mapCheckStatus } from "../src/copilot/authStatus";

const VERSION = "1.520.0";

function findLanguageServer(): string | null {
	const candidates = [
		path.join(
			os.homedir(),
			"Documents/Logseq/.obsidian/plugins/github-copilot-autocomplete",
			`copilot-${VERSION}`,
			"language-server.js",
		),
		path.join(
			process.cwd(),
			`.tmp/copilot-${VERSION}`,
			"language-server.js",
		),
	];
	for (const c of candidates) {
		if (fs.existsSync(c)) {
			return c;
		}
	}
	return null;
}

export async function runIntegrationLsTests(): Promise<void> {
	const ls = findLanguageServer();
	if (!ls) {
		console.log(
			`integrationLs tests skipped (language-server ${VERSION} not installed yet)`,
		);
		return;
	}

	const node = process.execPath;
	const agent = spawn(node, [ls, "--stdio"], { stdio: "pipe" });
	const endpoint = new SafeJsonRpcEndpoint(agent.stdin, agent.stdout);

	const rootUri = FileUri.fromAbsolutePath(path.join(os.tmpdir(), "obsidian-copilot-test"));
	let configRequested = false;

	endpoint.on(
		"workspace/configuration",
		(
			params: { items?: Array<{ section?: string }> },
			respond?: (result: unknown) => void,
		) => {
			configRequested = true;
			const items = params?.items || [];
			respond?.(
				items.map((item) =>
					item.section === "telemetry"
						? { telemetryLevel: "off" }
						: {},
				),
			);
		},
	);

	endpoint.on("didChangeStatus", () => {
		// observed; mapping covered in unit tests
	});

	try {
		const init = (await endpoint.send("initialize", {
			processId: agent.pid,
			capabilities: {
				workspace: {
					workspaceFolders: true,
					configuration: true,
					executeCommand: { dynamicRegistration: true },
				},
				window: { showDocument: { support: true } },
			},
			clientInfo: { name: "ObsidianCopilotTest", version: "0.0.1" },
			rootUri,
			workspaceFolders: [{ name: "t", uri: rootUri }],
			initializationOptions: {
				editorInfo: { name: "obsidian", version: "0.0.1" },
				editorPluginInfo: { name: "obsidian-copilot", version: "0.0.1" },
			},
		})) as { capabilities?: unknown };

		assert.ok(init?.capabilities, "initialize should return capabilities");
		endpoint.notify("initialized", {});

		endpoint.notify("workspace/didChangeConfiguration", {
			settings: {
				telemetry: { telemetryLevel: "off" },
			},
		});

		const status = (await endpoint.send("checkStatus", {
			localChecksOnly: false,
		})) as { status?: string };
		const mapped = mapCheckStatus(status);
		assert.ok(
			mapped === "signedIn" || mapped === "signedOut" || mapped === "unknown",
			"checkStatus should map to a known auth state",
		);

		// Open a document with encoded URI (space in path component).
		const docUri = FileUri.fromVaultPath(
			path.join(os.tmpdir(), "obsidian vault"),
			"note with space.md",
		);
		assert.ok(docUri.includes("%20") || decodeURIComponent(docUri).includes(" "));
		endpoint.notify("textDocument/didOpen", {
			textDocument: {
				uri: docUri,
				languageId: "markdown",
				version: 1,
				text: "# hello\n",
			},
		});

		// configRequested may or may not fire depending on server version; not required.
		void configRequested;

		console.log(
			`integrationLs tests passed (status=${status.status}, mapped=${mapped})`,
		);
	} finally {
		endpoint.dispose();
		agent.kill("SIGTERM");
	}
}
