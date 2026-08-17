import esbuild from "esbuild";
import { mkdirSync } from "fs";

mkdirSync(".tmp", { recursive: true });

await esbuild.build({
	entryPoints: ["tests/run.ts"],
	bundle: true,
	platform: "node",
	target: "node18",
	format: "cjs",
	outfile: ".tmp/tests.js",
	sourcemap: false,
	external: [],
	logLevel: "info",
});
