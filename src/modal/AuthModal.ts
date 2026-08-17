import { Modal, Notice, Setting } from "obsidian";
import CopilotPlugin from "../main";
import type { CopilotCommand } from "../copilot/Client";

class AuthModal extends Modal {
	private plugin: CopilotPlugin;
	private userCode: string;
	private command: CopilotCommand;
	private verificationUrl?: string;
	private statusEl: HTMLElement | null = null;
	private opening = false;
	private refreshing = false;
	private deviceFlowPromise: Promise<void> | null = null;
	private closed = false;
	private pollTimer: number | null = null;

	constructor(
		plugin: CopilotPlugin,
		userCode: string,
		command: CopilotCommand,
		verificationUrl?: string,
	) {
		super(plugin.app);
		this.plugin = plugin;
		this.userCode = userCode;
		this.command = command;
		this.verificationUrl = verificationUrl;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.createEl("h2", { text: "Sign in to GitHub Copilot" });
		const box = contentEl.createEl("div", {
			cls: "copilot-modal-auth-box",
		});
		box.createEl("p", {
			text: "GitHub will ask for this one-time code:",
		});
		box.createEl("strong", {
			text: this.userCode,
			cls: "copilot-modal-auth-code",
		});

		if (this.verificationUrl) {
			const help = box.createEl("p", {
				text: "If the browser does not open, visit ",
			});
			help.createEl("a", {
				text: this.verificationUrl,
				attr: { href: this.verificationUrl },
			});
			help.createSpan({ text: "." });
		}

		this.statusEl = contentEl.createEl("p", {
			text: "Starting GitHub sign-in...",
			cls: "copilot-modal-auth-status",
		});

		new Setting(contentEl)
			.addButton((btn) =>
				btn.setButtonText("Copy code to clipboard").onClick(() => {
					navigator.clipboard
						.writeText(this.userCode)
						.then(() => new Notice("Copied Copilot sign-in code."))
						.catch((error) => {
							new Notice("Failed to copy code: " + error);
						});
				}),
			)
			.addButton((btn) =>
				btn
					.setButtonText("Open GitHub sign-in")
					.setCta()
					.onClick(async () => {
						await this.openSignInPage();
					}),
			);

		new Setting(contentEl).addButton((btn) =>
			btn
				.setButtonText("I authorized GitHub, check status")
				.onClick(async () => {
					await this.refreshStatus();
				}),
		);

		void navigator.clipboard.writeText(this.userCode).catch(() => {
			// Clipboard may be denied; user can still copy manually.
		});
		void this.openSignInPage();
		this.startStatusPolling();
	}

	private setStatus(text: string): void {
		if (this.statusEl) {
			this.statusEl.setText(text);
		}
	}

	private startStatusPolling(): void {
		this.clearStatusPolling();
		this.pollTimer = window.setInterval(() => {
			void this.refreshStatus(false);
		}, 3000);
	}

	private clearStatusPolling(): void {
		if (this.pollTimer !== null) {
			window.clearInterval(this.pollTimer);
			this.pollTimer = null;
		}
	}

	private async openSignInPage(): Promise<void> {
		if (this.opening || this.closed) {
			return;
		}

		this.opening = true;
		this.setStatus("Opening GitHub sign-in...");

		try {
			// Open the device page from the Obsidian process first. Relying only on
			// the language server child process is unreliable inside Electron.
			if (this.verificationUrl) {
				await this.plugin.copilotAgent
					.getClient()
					.openExternalUrl(this.verificationUrl);
			}

			// finishDeviceFlow waits until the user completes browser auth.
			// Keep it off the UI thread path for "check status".
			if (!this.deviceFlowPromise) {
				this.deviceFlowPromise = this.plugin.copilotAgent
					.getClient()
					.executeCommand(this.command)
					.then(async () => {
						if (!this.closed) {
							await this.refreshStatus(false);
						}
					})
					.catch((error) => {
						if (!this.closed) {
							this.setStatus(
								"Device flow still running or failed. Use the link above, then check status.",
							);
							new Notice("Copilot device flow error: " + error);
						}
					})
					.finally(() => {
						this.deviceFlowPromise = null;
					});
			}

			this.setStatus(
				"Enter the code on GitHub, then wait or press check status.",
			);
		} catch (error) {
			this.setStatus(
				"Could not open GitHub sign-in. Use the link above, then check status.",
			);
			new Notice("Failed to open Copilot sign-in: " + error);
		} finally {
			this.opening = false;
		}
	}

	private async refreshStatus(showPendingNotice = true): Promise<void> {
		if (this.closed || this.refreshing) {
			return;
		}

		this.refreshing = true;
		this.setStatus("Checking Copilot account status...");
		try {
			await this.plugin.copilotAgent.refreshAuthenticationStatus();
			if (this.closed) {
				return;
			}

			if (this.plugin.copilotAgent.isSignedIn()) {
				this.clearStatusPolling();
				new Notice("Signed in successfully.");
				try {
					await this.plugin.copilotAgent.getClient().setEditorInfo();
				} catch {
					// Non-fatal after successful auth.
				}
				if (!this.closed) {
					this.plugin.settingsTab.display();
					this.close();
				}
				return;
			}

			this.setStatus(
				"Still waiting for GitHub authorization. Finish the browser flow, then check again.",
			);
			if (showPendingNotice) {
				new Notice("Copilot is still waiting for GitHub authorization.");
			}
		} finally {
			this.refreshing = false;
		}
	}

	onClose() {
		this.closed = true;
		this.clearStatusPolling();
		const { contentEl } = this;
		contentEl.empty();
	}
}

export default AuthModal;
