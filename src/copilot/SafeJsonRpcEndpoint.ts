import { EventEmitter } from "events";
import { Readable, Writable } from "stream";

type Pending = {
	resolve: (value: unknown) => void;
	reject: (error: Error) => void;
	timer: ReturnType<typeof setTimeout> | null;
};

const DEFAULT_REQUEST_TIMEOUT_MS = 30_000;

/**
 * Drop-in JSON-RPC endpoint for the Copilot language server.
 *
 * Unlike @pierrad/ts-lsp-client's endpoint, this correctly:
 * - matches responses by request id (concurrent requests work)
 * - distinguishes server requests from client responses
 * - answers server requests (e.g. window/showDocument)
 * - times out hung requests instead of hanging forever
 */
class SafeJsonRpcEndpoint extends EventEmitter {
	private writable: Writable;
	private nextId = 0;
	private pending = new Map<number, Pending>();
	private buffer = Buffer.alloc(0);
	private disposed = false;

	constructor(writable: Writable, readable: Readable) {
		super();
		this.writable = writable;
		readable.on("data", (chunk: Buffer | string) => {
			this.onData(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
		});
		readable.on("error", (error) => {
			this.failAll(error instanceof Error ? error : new Error(String(error)));
			this.emit("error", error);
		});
		readable.on("end", () => {
			this.failAll(new Error("Copilot language server closed stdout"));
		});
	}

	public send(
		method: string,
		params?: unknown,
		timeoutMs: number = DEFAULT_REQUEST_TIMEOUT_MS,
	): Promise<unknown> {
		if (this.disposed) {
			return Promise.reject(new Error("JSON-RPC endpoint disposed"));
		}

		const id = this.nextId++;
		return new Promise((resolve, reject) => {
			const timer =
				timeoutMs > 0
					? setTimeout(() => {
							if (!this.pending.has(id)) {
								return;
							}
							this.pending.delete(id);
							reject(
								new Error(
									`Request timed out after ${timeoutMs}ms: ${method}`,
								),
							);
						}, timeoutMs)
					: null;

			this.pending.set(id, { resolve, reject, timer });
			try {
				this.write({ jsonrpc: "2.0", id, method, params });
			} catch (error) {
				this.clearPending(id);
				reject(error instanceof Error ? error : new Error(String(error)));
			}
		});
	}

	public notify(method: string, params?: unknown): void {
		if (this.disposed) {
			return;
		}
		this.write({ jsonrpc: "2.0", method, params });
	}

	public dispose(): void {
		this.disposed = true;
		this.failAll(new Error("JSON-RPC endpoint disposed"));
		this.removeAllListeners();
	}

	private clearPending(id: number): Pending | undefined {
		const pending = this.pending.get(id);
		if (!pending) {
			return undefined;
		}
		if (pending.timer) {
			clearTimeout(pending.timer);
		}
		this.pending.delete(id);
		return pending;
	}

	private write(message: Record<string, unknown>): void {
		const body = JSON.stringify(message);
		const payload = `Content-Length: ${Buffer.byteLength(body, "utf8")}\r\n\r\n${body}`;
		this.writable.write(payload);
	}

	private respond(id: number, result: unknown): void {
		if (this.disposed) {
			return;
		}
		this.write({ jsonrpc: "2.0", id, result });
	}

	private failAll(error: Error): void {
		for (const [id] of this.pending) {
			const pending = this.clearPending(id);
			pending?.reject(error);
		}
	}

	private onData(chunk: Buffer): void {
		this.buffer = Buffer.concat([this.buffer, chunk]);

		while (true) {
			const headerEnd = this.buffer.indexOf("\r\n\r\n");
			if (headerEnd === -1) {
				return;
			}

			const header = this.buffer.slice(0, headerEnd).toString("utf8");
			const match = header.match(/Content-Length:\s*(\d+)/i);
			if (!match) {
				this.buffer = this.buffer.slice(headerEnd + 4);
				this.emit("error", new Error(`Bad JSON-RPC header: ${header}`));
				continue;
			}

			const length = Number.parseInt(match[1], 10);
			if (!Number.isFinite(length) || length < 0 || length > 20_000_000) {
				this.buffer = this.buffer.slice(headerEnd + 4);
				this.emit(
					"error",
					new Error(`Invalid Content-Length: ${match[1]}`),
				);
				continue;
			}

			const bodyStart = headerEnd + 4;
			if (this.buffer.length < bodyStart + length) {
				return;
			}

			const body = this.buffer
				.slice(bodyStart, bodyStart + length)
				.toString("utf8");
			this.buffer = this.buffer.slice(bodyStart + length);

			try {
				this.handleMessage(JSON.parse(body));
			} catch (error) {
				this.emit(
					"error",
					error instanceof Error ? error : new Error(String(error)),
				);
			}
		}
	}

	private handleMessage(message: {
		id?: number;
		method?: string;
		params?: unknown;
		result?: unknown;
		error?: { message?: string; code?: number };
	}): void {
		// Client response
		if (message.id !== undefined && message.method === undefined) {
			const pending = this.clearPending(message.id);
			if (!pending) {
				return;
			}
			if (message.error) {
				pending.reject(
					new Error(
						message.error.message ||
							`JSON-RPC error ${message.error.code ?? ""}`.trim(),
					),
				);
				return;
			}
			pending.resolve(message.result);
			return;
		}

		// Server request or notification
		if (!message.method) {
			return;
		}

		if (message.id === undefined) {
			this.emit(message.method, message.params);
			return;
		}

		const id = message.id;
		let answered = false;
		const respond = (result: unknown) => {
			if (answered || this.disposed) {
				return;
			}
			answered = true;
			this.respond(id, result);
		};

		this.emit(message.method, message.params, respond);

		// Keep the language server unblocked if no listener answers.
		const timeoutMs =
			message.method === "window/showDocument" ? 15_000 : 1_000;
		setTimeout(() => {
			if (!answered) {
				respond(
					message.method === "window/showDocument"
						? { success: false }
						: null,
				);
			}
		}, timeoutMs);
	}
}

export default SafeJsonRpcEndpoint;
