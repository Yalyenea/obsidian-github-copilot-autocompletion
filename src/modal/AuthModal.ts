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
			text: "Opening GitHub sign-in...",
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

		void this.openSignInPage();
	}

	private setStatus(text: string): void {
		if (this.statusEl) {
			this.statusEl.setText(text);
		}
	}

	private async openSignInPage(): Promise<void> {
		if (this.opening) {
			return;
		}

		this.opening = true;
		this.setStatus("Opening GitHub sign-in...");

		try {
			await this.plugin.copilotAgent
				.getClient()
				.executeCommand(this.command);
			await this.refreshStatus(false);
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
		this.setStatus("Checking Copilot account status...");
		await this.plugin.copilotAgent.refreshAuthenticationStatus();

		if (this.plugin.copilotAgent.isSignedIn()) {
			new Notice("Signed in successfully.");
			await this.plugin.copilotAgent.getClient().setEditorInfo();
			this.plugin.settingsTab.display();
			this.close();
			return;
		}

		this.plugin.copilotAgent.setAuthenticationStatus("signedOut");
		this.setStatus(
			"Still waiting for GitHub authorization. Finish the browser flow, then check again.",
		);
		if (showPendingNotice) {
			new Notice("Copilot is still waiting for GitHub authorization.");
		}
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}

export default AuthModal;
