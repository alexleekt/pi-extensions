import { useMemo, useState } from "react";
import { renderMarkdown } from "../util/markdown";

interface MarkdownPreviewProps {
    text: string;
    className?: string;
}

export default function MarkdownPreview({ text, className = "" }: MarkdownPreviewProps) {
    const [showPreview, setShowPreview] = useState(false);
    const html = useMemo(() => renderMarkdown(text), [text]);

    if (!text.trim()) return null;

    return (
        <div className={className}>
            <button
                type="button"
                onClick={() => setShowPreview((s) => !s)}
                className="mb-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
                {showPreview ? "Hide preview" : "Preview markdown"}
            </button>
            {showPreview && (
                <div
                    className="rounded-md border border-border bg-muted/30 p-2 text-sm prose prose-sm max-w-none"
                    dangerouslySetInnerHTML={{ __html: html }}
                />
            )}
        </div>
    );
}
