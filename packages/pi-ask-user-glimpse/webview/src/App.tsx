import type { AskUserPayload } from "../../shared/ask-user";
import SingleSelect from "./components/SingleSelect";
import MultiSelect from "./components/MultiSelect";
import Freeform from "./components/Freeform";
import Questionnaire from "./components/Questionnaire";
import ContextPanel from "./components/ContextPanel";
import ErrorBoundary from "./components/ErrorBoundary";

function getPayload(): AskUserPayload {
	const raw = (window as unknown as Record<string, unknown>).__ASK_USER_PAYLOAD__;
	if (!raw || typeof raw !== "object") {
		throw new Error("Missing or invalid ask_user payload");
	}
	return raw as AskUserPayload;
}

function renderComponent(payload: AskUserPayload, showHeader = true) {
	switch (payload.type) {
		case "single-select":
			return <SingleSelect payload={payload} showHeader={showHeader} />;
		case "multi-select":
			return <MultiSelect payload={payload} showHeader={showHeader} />;
		case "questionnaire":
			return <Questionnaire payload={payload} showHeader={showHeader} />;
		case "freeform":
			return <Freeform payload={payload} showHeader={showHeader} />;
		default:
			return (
				<div className="flex h-full items-center justify-center p-4">
					<div className="rounded-lg border border-destructive bg-destructive/10 p-4 text-destructive">
						Unknown prompt type: {payload.type}
					</div>
				</div>
			);
	}
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

	const hasContext = !!payload.context;

	if (!hasContext) {
		return <div className="h-screen">{renderComponent(payload)}</div>;
	}

	// Strip context from the payload passed to the question component
	// so it doesn't duplicate what the left panel already shows.
	const componentPayload: AskUserPayload = { ...payload, context: undefined };

	return (
		<div className="flex h-screen flex-col overflow-hidden">
			{/* Full-width question header */}
			<div className="shrink-0 border-b border-border px-6 py-4">
				<h1 className="text-xl font-semibold leading-snug">
					{payload.question}
				</h1>
			</div>

			<div className="flex flex-1 overflow-hidden">
				{/* Left panel: Agent context rendered as markdown */}
				<div className="flex w-2/5 flex-col border-r border-border overflow-hidden">
					<div className="flex-1 overflow-y-auto p-4">
						<ErrorBoundary>
							{/* hasContext guarantees payload.context is defined */}
						<ContextPanel context={payload.context!} />
						</ErrorBoundary>
					</div>
				</div>

				{/* Right panel: Options / input */}
				<div className="flex w-3/5 flex-col overflow-hidden">
					<ErrorBoundary>
						{renderComponent(componentPayload, false)}
					</ErrorBoundary>
				</div>
			</div>
		</div>
	);
}
