import * as assert from "assert";
import {
	mapCheckStatus,
	mapStatusNotification,
} from "../src/copilot/authStatus";

export function runAuthStatusTests(): void {
	assert.strictEqual(mapCheckStatus({ status: "OK" }), "signedIn");
	assert.strictEqual(mapCheckStatus({ status: "AlreadySignedIn" }), "signedIn");
	assert.strictEqual(mapCheckStatus({ status: "NotSignedIn" }), "signedOut");
	assert.strictEqual(mapCheckStatus({ status: "SomethingElse" }), "unknown");
	assert.strictEqual(
		mapCheckStatus({ result: { status: "NotSignedIn" } }),
		"signedOut",
	);

	assert.strictEqual(
		mapStatusNotification({
			kind: "Error",
			message: "You are not signed into GitHub.",
		}),
		"signedOut",
	);
	assert.strictEqual(
		mapStatusNotification({ kind: "Normal", message: "" }),
		"signedIn",
	);
	assert.strictEqual(
		mapStatusNotification({ kind: "Warning", message: "temporary network" }),
		null,
	);
	assert.strictEqual(mapStatusNotification(null), null);

	console.log("authStatus tests passed");
}
