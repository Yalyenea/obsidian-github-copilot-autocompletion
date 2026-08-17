import {
	existsSync,
	statSync,
	mkdirSync,
	readdirSync,
	rmSync,
	createWriteStream,
	unlink,
	unlinkSync,
} from "fs";
import https from "https";
import { join } from "path";
import AdmZip from "adm-zip";
import Logger from "./Logger";

class File {
	public static doesFolderExist(path: string): boolean {
		try {
			// stat follows symlinks (Homebrew paths are often linked).
			return existsSync(path) && statSync(path).isDirectory();
		} catch {
			return false;
		}
	}

	public static doesFileExist(path: string): boolean {
		try {
			// stat follows symlinks so /opt/homebrew/bin/node resolves correctly.
			return existsSync(path) && statSync(path).isFile();
		} catch {
			return false;
		}
	}

	public static createFolder(path: string): void {
		if (!this.doesFolderExist(path)) {
			mkdirSync(path, { recursive: true });
		}
	}

	public static removeOldCopilotFolders(
		currentVersion: string,
		path: string,
	): void {
		const copilotFolders = readdirSync(path).filter((folder) =>
			folder.startsWith("copilot"),
		);

		copilotFolders.forEach((folder) => {
			const folderVersion = folder.split("-")[1];
			if (folderVersion !== currentVersion) {
				const folderPath = join(path, folder);
				rmSync(folderPath, { recursive: true, force: true });
			}
		});
	}

	public static wrapFilePath(path: string): string {
		return `"${path}"`;
	}

	public static downloadFile(
		url: string,
		dest: string,
		cb: (err: Error) => void,
	) {
		const file = createWriteStream(dest);

		const request = https.get(url, (response) => {
			// Handle Redirects (GitHub uses 302)
			if (response.statusCode === 301 || response.statusCode === 302) {
				Logger.getInstance().log(
					`Redirecting to: ${response.headers.location}`,
				);
				return File.downloadFile(
					response.headers.location ?? "",
					dest,
					cb,
				);
			}
			if (response.statusCode !== 200) {
				return cb(
					new Error(
						`Failed to get '${url}' (${response.statusCode})`,
					),
				);
			}
			response.pipe(file);
			file.on("finish", () => {
				file.close(cb);
			});
		});
		request.on("error", (err) => {
			unlink(dest, () => cb(err)); // Delete the file if error
		});
	}

	public static unzipFile(zipPath: string, destDir: string) {
		const zip = new AdmZip(zipPath);
		zip.extractAllTo(destDir, true);
	}

	public static removeFile(path: string) {
		unlinkSync(path);
	}

	public static removePath(path: string): void {
		if (!existsSync(path)) {
			return;
		}
		rmSync(path, { recursive: true, force: true });
	}
}

export default File;
