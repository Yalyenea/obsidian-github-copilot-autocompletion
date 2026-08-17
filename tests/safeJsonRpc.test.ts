import * as assert from "assert";
import { PassThrough } from "stream";
import SafeJsonRpcEndpoint from "../src/copilot/SafeJsonRpcEndpoint";

function frame(message: Record<string, unknown>): string {
	const body = JSON.stringify(message);
	return `Content-Length: ${Buffer.byteLength(body)}\r\n\r\n${body}`;
}

export async function runSafeJsonRpcTests(): Promise<void> {
	const stdin = new PassThrough();
	const stdout = new PassThrough();
	const endpoint = new SafeJsonRpcEndpoint(stdin, stdout);

	// Concurrent requests match by id, not "latest only".
	const p1 = endpoint.send("one", {});
	const p2 = endpoint.send("two", {});

	// Respond out of order: id 1 first, then id 0.
	stdout.write(
		frame({ jsonrpc: "2.0", id: 1, result: { ok: 2 } }) +
			frame({ jsonrpc: "2.0", id: 0, result: { ok: 1 } }),
	);

	const [r1, r2] = await Promise.all([p1, p2]);
	assert.deepStrictEqual(r1, { ok: 1 });
	assert.deepStrictEqual(r2, { ok: 2 });

	// Server request window/showDocument is answered.
	let seenUri = "";
	endpoint.on(
		"window/showDocument",
		(
			params: { uri?: string },
			respond?: (result: unknown) => void,
		) => {
			seenUri = params?.uri || "";
			respond?.({ success: true });
		},
	);

	const written: Buffer[] = [];
	stdin.on("data", (chunk) => written.push(Buffer.from(chunk)));

	stdout.write(
		frame({
			jsonrpc: "2.0",
			id: 99,
			method: "window/showDocument",
			params: { uri: "https://github.com/login/device" },
		}),
	);

	await new Promise((r) => setTimeout(r, 20));
	assert.strictEqual(seenUri, "https://github.com/login/device");
	const reply = Buffer.concat(written).toString("utf8");
	assert.ok(reply.includes('"id":99'));
	assert.ok(reply.includes('"success":true'));

	// Timeout rejects hung requests.
	const hung = endpoint.send("hang", {}, 30);
	await assert.rejects(hung, /timed out/i);

	endpoint.dispose();
	console.log("safeJsonRpc tests passed");
}
