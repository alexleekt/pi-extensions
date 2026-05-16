import type { AskUserPayload } from "../../shared/ask-user";
import SingleSelect from "./components/SingleSelect";
import MultiSelect from "./components/MultiSelect";
import Freeform from "./components/Freeform";
import Questionnaire from "./components/Questionnaire";

function getPayload(): AskUserPayload {
	const raw = (window as unknown as Record<string, unknown>).__ASK_USER_PAYLOAD__;
	if (!raw || typeof raw !== "object") {
		throw new Error("Missing or invalid ask_user payload");
	}
	return raw as AskUserPayload;
}

export default function App() {
	let payload: AskUserPayload;
	try {
		payload = getPayload();
	} catch (err) {
		return (
			<div className="flex h-screen items-center justify-center p-4">
				<div className="rounded-lg border border-destructive bg-destructive/10 p-4 text-destructive">
					{err instanceof Error ? err.message : String(err)}
				</div>
			</div>
		);
	}

	switch (payload.type) {
		case "single-select":
			return <SingleSelect payload={payload} />;
		case "multi-select":
			return <MultiSelect payload={payload} />;
		case "questionnaire":
			return <Questionnaire payload={payload} />;
		case "freeform":
			return <Freeform payload={payload} />;
		default:
			return (
				<div className="flex h-screen items-center justify-center p-4">
					<div className="rounded-lg border border-destructive bg-destructive/10 p-4 text-destructive">
						Unknown prompt type: {payload.type}
					</div>
				</div>
			);
	}
}
