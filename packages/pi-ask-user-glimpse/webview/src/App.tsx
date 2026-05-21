import { useEffect, useState } from "react";
import type { AskUserPayload } from "../../shared/ask-user";
import ContextPanel from "./components/ContextPanel";
import ErrorBoundary from "./components/ErrorBoundary";
import Freeform from "./components/Freeform";
import HeaderBar from "./components/HeaderBar";
import MultiSelect from "./components/MultiSelect";
import Questionnaire from "./components/Questionnaire";
import ShortcutsModal from "./components/ShortcutsModal";
import SingleSelect from "./components/SingleSelect";

function getPayload(): AskUserPayload {
    const raw = (window as unknown as Record<string, unknown>)
        .__ASK_USER_PAYLOAD__;
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

const DEFAULT_PANEL_WIDTH = 50; // percent
const MIN_PANEL_WIDTH = 20;     // percent
const MAX_PANEL_WIDTH = 80;     // percent

export default function App() {
    const [showShortcuts, setShowShortcuts] = useState(false);
    const [panelWidth, setPanelWidth] = useState(DEFAULT_PANEL_WIDTH);
    const [isDragging, setIsDragging] = useState(false);
    const [isCollapsed, setIsCollapsed] = useState(false);

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

    const handleMouseDown = () => setIsDragging(true);

    useEffect(() => {
        if (!isDragging) return;
        const handleMouseMove = (e: MouseEvent) => {
            const newWidth = (e.clientX / window.innerWidth) * 100;
            setPanelWidth(Math.max(MIN_PANEL_WIDTH, Math.min(MAX_PANEL_WIDTH, newWidth)));
        };
        const handleMouseUp = () => setIsDragging(false);
        window.addEventListener("mousemove", handleMouseMove);
        window.addEventListener("mouseup", handleMouseUp);
        return () => {
            window.removeEventListener("mousemove", handleMouseMove);
            window.removeEventListener("mouseup", handleMouseUp);
        };
    }, [isDragging]);

    if (!hasContext) {
        return (
            <div className="flex h-screen flex-col overflow-hidden">
                <HeaderBar onShowShortcuts={() => setShowShortcuts(true)} question={payload.question} />
                {showShortcuts && <ShortcutsModal onClose={() => setShowShortcuts(false)} />}
                <div className="flex-1 overflow-hidden">{renderComponent(payload, false)}</div>
            </div>
        );
    }

    // Strip context from the payload passed to the question component
    // so it doesn't duplicate what the left panel already shows.
    const componentPayload: AskUserPayload = { ...payload, context: undefined };

    return (
        <div className="flex h-screen flex-col overflow-hidden">
            <HeaderBar onShowShortcuts={() => setShowShortcuts(true)} question={payload.question} />
            {showShortcuts && <ShortcutsModal onClose={() => setShowShortcuts(false)} />}

            <div className="flex flex-1 overflow-hidden">
                {/* Left panel: Agent context rendered as markdown */}
                <div
                    className={`flex flex-col border-r border-border overflow-hidden transition-all duration-200 ${
                        isCollapsed ? "w-0 opacity-0" : "opacity-100"
                    }`}
                    style={isCollapsed ? undefined : { width: `${panelWidth}%` }}
                >
                    <div className="flex-1 overflow-y-auto p-4">
                        <ErrorBoundary>
                            {/* hasContext guarantees payload.context is defined */}
                            <ContextPanel context={payload.context!} />
                        </ErrorBoundary>
                    </div>
                </div>

                {/* Resizable splitter */}
                <div
                    className={`relative flex w-3 shrink-0 cursor-col-resize items-center justify-center transition-colors hover:bg-primary/20 ${
                        isDragging ? "bg-primary/30" : "bg-border"
                    }`}
                    onMouseDown={(e) => {
                        if (isCollapsed) {
                            e.preventDefault();
                            setIsCollapsed(false);
                            setPanelWidth(DEFAULT_PANEL_WIDTH);
                            return;
                        }
                        handleMouseDown();
                    }}
                    onDoubleClick={() => {
                        if (isCollapsed) {
                            setIsCollapsed(false);
                            setPanelWidth(DEFAULT_PANEL_WIDTH);
                        } else {
                            setIsCollapsed(true);
                        }
                    }}
                    title={isCollapsed ? "Click to expand" : "Drag to resize · Double-click to collapse"}
                >
                    {/* Collapse / expand button */}
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            if (isCollapsed) {
                                setIsCollapsed(false);
                                setPanelWidth(DEFAULT_PANEL_WIDTH);
                            } else {
                                setIsCollapsed(true);
                            }
                        }}
                        className="flex h-6 w-6 items-center justify-center rounded-full bg-muted-foreground/10 text-muted-foreground transition-colors hover:bg-primary/20 hover:text-foreground"
                        title={isCollapsed ? "Expand context panel" : "Collapse context panel"}
                    >
                        {isCollapsed ? (
                            <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M6 2l6 6-6 6" />
                            </svg>
                        ) : (
                            <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M10 2l-6 6 6 6" />
                            </svg>
                        )}
                    </button>
                    {/* Grip handle */}
                    {!isCollapsed && (
                        <div className={`absolute h-8 w-1 rounded-full transition-colors ${
                            isDragging ? "bg-primary/60" : "bg-muted-foreground/20"
                        }`} />
                    )}
                </div>

                {/* Right panel: Options / input */}
                <div className="flex flex-1 flex-col overflow-hidden">
                    <ErrorBoundary>
                        {renderComponent(componentPayload, false)}
                    </ErrorBoundary>
                </div>
            </div>
        </div>
    );
}
