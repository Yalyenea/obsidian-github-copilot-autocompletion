import { runFileUriTests } from "./fileUri.test";
import { runAuthStatusTests } from "./authStatus.test";
import { runSafeJsonRpcTests } from "./safeJsonRpc.test";
import { runLspUriTests } from "./lspUri.test";
import { runIntegrationLsTests } from "./integrationLs.test";

async function main() {
	runFileUriTests();
	runAuthStatusTests();
	runLspUriTests();
	await runSafeJsonRpcTests();
	await runIntegrationLsTests();
	console.log("\nAll tests passed.");
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
