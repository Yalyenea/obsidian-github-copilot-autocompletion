export type AuthStatus = "unknown" | "signedIn" | "signedOut";

export type StatusPayload = {
	status?: string;
	kind?: string;
	message?: string;
	result?: {
		status?: string;
	};
};

/**
 * Map checkStatus / signIn style payloads to a local auth status.
 */
export function mapCheckStatus(payload: StatusPayload | null | undefined): AuthStatus {
	const status =
		typeof payload?.status === "string"
			? payload.status
			: typeof payload?.result?.status === "string"
				? payload.result.status
				: null;

	if (
		status === "OK" ||
		status === "AlreadySignedIn" ||
		status === "Normal"
	) {
		return "signedIn";
	}
	if (status === "NotSignedIn") {
		return "signedOut";
	}
	return "unknown";
}

/**
 * Map didChangeStatus / statusNotification payloads from the language server.
 */
export function mapStatusNotification(
	payload: StatusPayload | null | undefined,
): AuthStatus | null {
	if (!payload) {
		return null;
	}

	const kind = typeof payload.kind === "string" ? payload.kind : "";
	const status = typeof payload.status === "string" ? payload.status : "";
	const message =
		typeof payload.message === "string"
			? payload.message.toLowerCase()
			: "";

	if (
		message.includes("not signed") ||
		message.includes("not signed into github")
	) {
		return "signedOut";
	}

	if (kind === "Normal" || status === "Normal" || status === "OK") {
		return "signedIn";
	}

	// Temporary warnings/errors (network, quota) should not wipe a known session.
	return null;
}
