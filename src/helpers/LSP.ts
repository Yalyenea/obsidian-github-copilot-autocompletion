import {
	DidChangeTextDocumentParams,
	DidOpenTextDocumentParams,
	GetCompletionsParams,
} from "@pierrad/ts-lsp-client";
import FileUri from "./FileUri";

class LSP {
	private static asFileUri(uriOrPath: string): string {
		if (uriOrPath.startsWith("file:")) {
			return uriOrPath;
		}
		return FileUri.fromAbsolutePath(uriOrPath);
	}

	public static createDidOpenParams(args: {
		uri: string;
		version: number;
		text: string;
	}): DidOpenTextDocumentParams {
		return {
			textDocument: {
				uri: this.asFileUri(args.uri),
				languageId: "markdown",
				version: args.version,
				text: args.text,
			},
		};
	}

	public static createDidChangeParams(args: {
		uri: string;
		version: number;
		text: string;
	}): DidChangeTextDocumentParams {
		return {
			textDocument: {
				uri: this.asFileUri(args.uri),
				version: args.version,
			},
			contentChanges: [
				{
					text: args.text,
				},
			],
		};
	}

	public static createCompletionParams(args: {
		uri: string;
		relativePath: string;
		line: number;
		character: number;
		version: number;
		indentSize?: number;
	}): GetCompletionsParams {
		return {
			textDocument: {
				uri: this.asFileUri(args.uri),
				version: args.version,
			},
			position: {
				line: args.line,
				character: args.character,
			},
			context: {
				triggerKind: 1,
			},
			formattingOptions: {
				tabSize: args.indentSize || 4,
				indentSize: args.indentSize || 4,
				insertSpaces: true,
			},
		};
	}
}

export default LSP;
