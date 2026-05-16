import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const CONFLICTING_TOOLS = ["ask_user"];
const CONFLICTING_PACKAGES = ["pi-ask-user", "@juicesharp/rpiv-ask-user-question"];

function isNotInitializedError(err: unknown): boolean {
	return err instanceof Error && err.message.includes("Extension runtime not initialized");
}

export function detectConflict(pi: ExtensionAPI) {
	let allTools: ReturnType<ExtensionAPI["getAllTools"]>;
	try {
		allTools = pi.getAllTools();
	} catch (err: unknown) {
		// Extension runtime not yet initialized — skip conflict detection
		if (isNotInitializedError(err)) {
			return;
		}
		throw err;
	}

	const conflicts = allTools.filter(
		(t) =>
			CONFLICTING_TOOLS.includes(t.name) &&
			CONFLICTING_PACKAGES.some((pkg) =>
				t.sourceInfo?.path?.includes(pkg),
			),
	);

	if (conflicts.length > 0) {
		const names = conflicts.map((t) => `${t.name} from ${t.sourceInfo?.path ?? "unknown"}`).join(", ");
		console.warn(
			`[pi-ask-user-glimpse] Warning: detected potentially conflicting tool(s): ${names}. ` +
				`pi-ask-user-glimpse may conflict with existing ask_user implementations. ` +
				`Consider uninstalling pi-ask-user or rpiv-ask-user-question to avoid ambiguity.`,
		);
	}
}
