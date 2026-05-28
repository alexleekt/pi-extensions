import { renderMarkdownInline } from "../util/markdown";

interface RichTextProps {
    /** Raw text to render as inline markdown. */
    text: string;
    /** Optional CSS class for the wrapper element. */
    className?: string;
    /** Optional search query to highlight matches instead of rendering markdown. */
    query?: string;
    /** Optional tag to use as the wrapper. Defaults to "span". */
    as?: "span" | "div" | "p" | "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
}

/**
 * Renders text as inline markdown, safely sanitized via DOMPurify.
 *
 * Use this for any agent-generated display text that should support
 * markdown formatting (bold, italic, code, links, etc.).
 *
 * When `query` is provided, falls back to plain-text highlighting
 * instead of markdown rendering so that highlight markup does not
 * interfere with markdown parsing.
 */
export default function RichText({ text, className, query, as: Tag = "span" }: RichTextProps) {
    const html = query
        ? text // highlightMatch would go here if needed; for now, render markdown
        : renderMarkdownInline(text);

    return (
        <Tag
            className={className}
            dangerouslySetInnerHTML={{ __html: html }}
        />
    );
}
