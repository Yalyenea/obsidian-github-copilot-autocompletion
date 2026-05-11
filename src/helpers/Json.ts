class Json {
	public static extractJsonObject(input: string): object | null {
		const jsonString = input.trim().replace(/^[^{]+/, "");

		if (jsonString.startsWith("{") && jsonString.endsWith("}")) {
			try {
				const jsonObject = JSON.parse(jsonString);
				return jsonObject;
			} catch (error) {
				console.error(`Error parsing JSON: ${error}`);
			}
		}
		return null;
	}

	/**
	 * Separate multiple JSON objects from a string. Each JSON object is expected to start with "Content-Length: XX"
	 * @param input The input string containing multiple JSON objects
	 * @returns An array of JSON object strings
	 */
	public static splitJsonObjects(input: string): string[] {
		const regex =
			/Content-Length:\s*\d+\s*([\s\S]*?)(?=Content-Length:|$)/g;
		const matches = [];
		let match;

		while ((match = regex.exec(input)) !== null) {
			matches.push(match[1].trim());
		}

		return matches;
	}
}

export default Json;
