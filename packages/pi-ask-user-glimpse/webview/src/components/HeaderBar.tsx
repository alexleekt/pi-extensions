import { renderMarkdownInline } from "../util/markdown";
import SettingsButton from "./SettingsButton";

interface HeaderBarProps {
    question?: string;
}

export default function HeaderBar({ question }: HeaderBarProps) {
    return (
        <div className="flex shrink-0 items-start justify-between border-b border-border bg-card px-4 py-3 gap-3">
            <div className="flex-1 min-w-0">
                <h1
                    className="text-base font-semibold leading-snug text-foreground"
                    dangerouslySetInnerHTML={{
                        __html: question
                            ? renderMarkdownInline(question)
                            : "Ask User",
                    }}
                />
            </div>
            <div className="flex shrink-0 items-center gap-1 pt-0.5">
                <SettingsButton />
            </div>
        </div>
    );
}
