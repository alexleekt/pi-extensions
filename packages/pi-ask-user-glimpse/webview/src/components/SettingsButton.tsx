import { useState } from "react";
import type { AnimationLevel, ThemeMode } from "../../../shared/ask-user";
import { useSettings } from "../util/settings";

function CogIcon() {
    return (
        <svg width="20" height="20" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="8" cy="8" r="2.5" />
            <path d="M12.8 8a4.8 4.8 0 0 0 .2-1.2l1.8-.5-.9-2.4-1.8.5a4.8 4.8 0 0 0-1.2-.7l.2-1.9h-2.6l.2 1.9a4.8 4.8 0 0 0-1.2.7l-1.8-.5-.9 2.4 1.8.5a4.8 4.8 0 0 0 .2 1.2l-1.8.5.9 2.4 1.8-.5a4.8 4.8 0 0 0 1.2.7l-.2 1.9h2.6l-.2-1.9a4.8 4.8 0 0 0 1.2-.7l1.8.5.9-2.4-1.8-.5z" />
        </svg>
    );
}

function ThemeIcon({ theme }: { theme: ThemeMode }) {
    if (theme === "dark") return (
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12.8 11.2A5.5 5.5 0 0 1 6.3 2.7 6.5 6.5 0 1 0 12.8 11.2z" />
        </svg>
    );
    if (theme === "light") return (
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="8" cy="8" r="3" />
            <path d="M8 1v1.5M8 13.5V15M1 8h1.5M13.5 8H15M3.05 3.05l1.06 1.06M11.9 11.9l1.06 1.06M3.05 12.95l1.06-1.06M11.9 4.1l1.06-1.06" />
        </svg>
    );
    return (
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="3" width="12" height="10" rx="2" />
            <path d="M5 8h6" />
        </svg>
    );
}

interface SettingsButtonProps {
    buttonClassName?: string;
}

export default function SettingsButton({ buttonClassName }: SettingsButtonProps) {
    const { theme, setTheme, animationLevel, setAnimationLevel } = useSettings();
    const [open, setOpen] = useState(false);

    const themeOptions: { value: ThemeMode; label: string }[] = [
        { value: "light", label: "☀️ Light" },
        { value: "dark", label: "🌙 Dark" },
        { value: "system", label: "💻 System" },
    ];

    const animationOptions: { value: AnimationLevel; label: string }[] = [
        { value: "none", label: "○ None" },
        { value: "minimal", label: "○ Minimal" },
        { value: "all", label: "● All" },
    ];

    return (
        <div className="relative">
            <button
                onClick={() => setOpen((s) => !s)}
                className={buttonClassName ?? "rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"}
                title="Settings"
            >
                <CogIcon />
            </button>
            {open && (
                <>
                    <div
                        className="fixed inset-0 z-40"
                        onClick={() => setOpen(false)}
                    />
                    <div className="absolute right-0 top-full z-50 mt-1 w-52 rounded-lg border border-border bg-popover p-2 shadow-lg">
                        <div className="mb-2 px-1 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                            Theme
                        </div>
                        {themeOptions.map((opt) => (
                            <button
                                key={opt.value}
                                onClick={() => {
                                    setTheme(opt.value);
                                }}
                                className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors ${
                                    theme === opt.value
                                        ? "bg-primary/10 text-primary font-medium"
                                        : "text-foreground hover:bg-accent"
                                }`}
                            >
                                <ThemeIcon theme={opt.value} />
                                {opt.label}
                            </button>
                        ))}
                        <div className="my-2 border-t border-border" />
                        <div className="mb-2 px-1 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                            Animations
                        </div>
                        {animationOptions.map((opt) => (
                            <button
                                key={opt.value}
                                onClick={() => {
                                    setAnimationLevel(opt.value);
                                }}
                                className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors ${
                                    animationLevel === opt.value
                                        ? "bg-primary/10 text-primary font-medium"
                                        : "text-foreground hover:bg-accent"
                                }`}
                            >
                                <span className="w-3.5 text-center">
                                    {animationLevel === opt.value ? "●" : "○"}
                                </span>
                                {opt.label.replace("○ ", "").replace("● ", "")}
                            </button>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}
