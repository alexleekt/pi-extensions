import { useMemo } from "react";
import { marked } from "marked";

interface ContextPanelProps {
	context: string;
}

/**
 * Lightweight sanitizer: strips <script> tags and event handlers.
 * Context comes from the agent, but defense in depth against a
 * compromised or confused LLM emitting raw HTML.
 */
function sanitizeHtml(html: string): string {
	return html
		.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
		.replace(/<script\b[^>]*\/>/gi, "")
		.replace(/on\w+\s*=\s*["'][^"']*["']/gi, "");
}

export default function ContextPanel({ context }: ContextPanelProps) {
	const html = useMemo(() => {
		const raw = marked.parse(context, { async: false }) as string;
		return sanitizeHtml(raw);
	}, [context]);

	return (
		<div
			className="markdown-body text-sm"
			dangerouslySetInnerHTML={{ __html: html }}
		/>
	);
}
