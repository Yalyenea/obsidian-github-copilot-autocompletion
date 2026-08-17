import * as path from "path";
import { pathToFileURL } from "url";

/**
 * Build a correctly encoded file:// URI for absolute or vault-relative paths.
 * Handles spaces, non-ASCII characters, and platform path separators.
 */
class FileUri {
	public static fromAbsolutePath(absolutePath: string): string {
		if (!absolutePath) {
			throw new Error("Absolute path is required");
		}
		if (absolutePath.startsWith("file:")) {
			return absolutePath;
		}
		return pathToFileURL(path.resolve(absolutePath)).href;
	}

	public static fromVaultPath(basePath: string, relativePath: string): string {
		const absolute = path.resolve(basePath, relativePath || ".");
		return this.fromAbsolutePath(absolute);
	}
}

export default FileUri;
