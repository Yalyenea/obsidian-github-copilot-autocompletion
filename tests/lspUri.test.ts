import * as assert from "assert";
import * as path from "path";
import { pathToFileURL } from "url";
import LSP from "../src/helpers/LSP";

export function runLspUriTests(): void {
	const abs = path.join("/tmp", "vault", "a b.md");
	const open = LSP.createDidOpenParams({
		uri: abs,
		version: 1,
		text: "hi",
	});
	assert.strictEqual(open.textDocument.uri, pathToFileURL(abs).href);

	const already = pathToFileURL(abs).href;
	const change = LSP.createDidChangeParams({
		uri: already,
		version: 2,
		text: "hello",
	});
	assert.strictEqual(change.textDocument.uri, already);

	const completion = LSP.createCompletionParams({
		uri: abs,
		relativePath: "a b.md",
		line: 0,
		character: 1,
		version: 3,
	});
	assert.strictEqual(completion.textDocument.uri, pathToFileURL(abs).href);

	console.log("lspUri tests passed");
}
