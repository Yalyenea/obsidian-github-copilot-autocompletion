import * as assert from "assert";
import * as path from "path";
import { pathToFileURL } from "url";
import FileUri from "../src/helpers/FileUri";

export function runFileUriTests(): void {
	const withSpace = path.join("/tmp", "my notes", "hello world.md");
	const uri = FileUri.fromAbsolutePath(withSpace);
	assert.ok(uri.startsWith("file://"), "uri should use file scheme");
	assert.ok(
		uri.includes("hello%20world.md") || decodeURIComponent(uri).includes("hello world.md"),
		"spaces should be encoded in file URI",
	);
	assert.strictEqual(uri, pathToFileURL(withSpace).href);

	const chinese = path.join("/tmp", "笔记", "测试.md");
	const chineseUri = FileUri.fromAbsolutePath(chinese);
	assert.ok(chineseUri.startsWith("file://"));
	assert.ok(
		chineseUri.includes("%") || decodeURIComponent(chineseUri).includes("测试.md"),
		"non-ascii path should encode safely",
	);

	const vaultUri = FileUri.fromVaultPath("/Users/me/Vault", "folder/a b.md");
	assert.strictEqual(
		vaultUri,
		pathToFileURL(path.resolve("/Users/me/Vault", "folder/a b.md")).href,
	);

	const already = "file:///tmp/x.md";
	assert.strictEqual(FileUri.fromAbsolutePath(already), already);

	console.log("fileUri tests passed");
}
