import { useState, useEffect } from "react";
import type { AskUserPayload } from "../../../shared/ask-user";

interface FreeformProps {
	payload: AskUserPayload;
}

export default function Freeform({ payload }: FreeformProps) {
	const [text, setText] = useState("");

	const handleSubmit = () => {
		(window as unknown as { glimpse: { send: (data: unknown) => void } }).glimpse.send({
			kind: "freeform",
			text: text.trim(),
		});
	};

	// Keyboard shortcuts
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			// Escape cancels the dialog
			if (e.key === "Escape") {
				(window as unknown as { glimpse: { send: (data: unknown) => void } }).glimpse.send({ __cancelled: true });
				return;
			}

			// Ctrl+Enter submits
			if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
				e.preventDefault();
				if (text.trim()) {
					handleSubmit();
				}
			}
		};

		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [text]);

	return (
		<div className="flex h-screen flex-col">
			<div className="border-b border-border p-4">
				<h1 className="text-lg font-semibold">{payload.question}</h1>
				{payload.context && (
					<p className="mt-1 text-sm text-muted-foreground">{payload.context}</p>
				)}
			</div>

			<div className="flex-1 p-4">
				<textarea
					value={text}
					onChange={(e) => setText(e.target.value)}
					placeholder="Type your answer..."
					className="h-full w-full resize-none rounded-md border border-input bg-background p-3 text-sm outline-none ring-offset-background focus:ring-2 focus:ring-ring"
					autoFocus
				/>
			</div>

			<div className="border-t border-border p-4">
				<div className="mb-2 text-xs text-muted-foreground">
					Press Ctrl+Enter to submit
				</div>
				<div className="flex justify-end gap-2">
					<button
						onClick={() =>
							(window as unknown as { glimpse: { send: (data: unknown) => void } }).glimpse.send({ __cancelled: true })
						}
						className="rounded-md border border-input bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-accent"
					>
						Cancel
					</button>
					<button
						onClick={handleSubmit}
						disabled={!text.trim()}
						className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
					>
						Submit
					</button>
				</div>
			</div>
		</div>
	);
}
