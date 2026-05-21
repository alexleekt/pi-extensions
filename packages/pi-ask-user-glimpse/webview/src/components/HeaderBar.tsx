import { renderMarkdownInline } from "../util/markdown";
import { HelpIcon } from "./icons";
import SettingsButton from "./SettingsButton";

interface HeaderBarProps {
    onShowShortcuts: () => void;
    question?: string;
}

export default function HeaderBar({ onShowShortcuts, question }: HeaderBarProps) {
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
                <button
                    onClick={onShowShortcuts}
                    className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                    title="Keyboard shortcuts"
                >
                    <HelpIcon />
                </button>
                <SettingsButton />
            </div>
        </div>
    );
}
