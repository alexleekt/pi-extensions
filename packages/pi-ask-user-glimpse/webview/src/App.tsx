import { useEffect, useState } from "react";
import type { AskUserPayload } from "../../shared/ask-user";
import ContextPanel from "./components/ContextPanel";
import ErrorBoundary from "./components/ErrorBoundary";
import Freeform from "./components/Freeform";
import HeaderBar from "./components/HeaderBar";
import MultiSelect from "./components/MultiSelect";
import Questionnaire from "./components/Questionnaire";
import SingleSelect from "./components/SingleSelect";

function getPayload(): AskUserPayload {
    const raw = (window as unknown as Record<string, unknown>)
        .__ASK_USER_PAYLOAD__;
    if (!raw || typeof raw !== "object") {
        throw new Error("Missing or invalid ask_user payload");
    }
    return raw as AskUserPayload;
}

function renderComponent(payload: AskUserPayload) {
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
                <div className="flex h-full items-center justify-center p-4">
                    <div className="rounded-lg border border-destructive bg-destructive/10 p-4 text-destructive">
                        Unknown prompt type: {payload.type}
                    </div>
                </div>
            );
    }
}

const DEFAULT_PANEL_WIDTH = 60; // percent — gives dialog 40% width for footer hints
const MIN_PANEL_WIDTH = 25;     // percent — ensures settings dropdown (208px) fits at 1000px window
const MAX_PANEL_WIDTH = 80;     // percent

export default function App() {
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
                <HeaderBar question={payload.question} />
                <div className="flex-1 overflow-hidden">{renderComponent(payload)}</div>
            </div>
        );
    }

    const componentPayload: AskUserPayload = { ...payload, context: undefined };

    return (
        <div className="flex h-screen flex-col overflow-hidden">
            <div className="flex flex-1 overflow-hidden">
                {/* Left panel */}
                <div
                    className={`flex flex-col overflow-hidden ${
                        isCollapsed ? "w-0 opacity-0" : "opacity-100"
                    }`}
                    style={isCollapsed ? undefined : { width: `${panelWidth}%` }}
                >
                    <ErrorBoundary>
                        {/* context is defined when hasContext is true */}
                        <ContextPanel
                            context={payload.context!}
                            contextFormat={payload.contextFormat}
                            question={payload.question}
                        />
                    </ErrorBoundary>
                </div>

                {/* Resizer */}
                <div
                    role="separator"
                    aria-orientation="vertical"
                    aria-label="Resize panels"
                    aria-valuenow={isCollapsed ? 0 : Math.round(panelWidth)}
                    aria-valuemin={MIN_PANEL_WIDTH}
                    aria-valuemax={MAX_PANEL_WIDTH}
                    className="group relative flex w-3 shrink-0 cursor-col-resize items-center justify-start"
                    onMouseDown={(e) => {
                        if (isCollapsed) {
                            e.preventDefault();
                            setIsCollapsed(false);
                            setPanelWidth(DEFAULT_PANEL_WIDTH);
                            return;
                        }
                        setIsDragging(true);
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
                    {/* Grip handle — positioned at the panel boundary (left edge of splitter) */}
                    <div
                        className={`h-8 rounded-full transition-colors ${
                            isDragging
                                ? "w-1.5 bg-primary/80"
                                : "w-1 bg-muted-foreground/50 group-hover:bg-muted-foreground/80"
                        }`}
                    />
                </div>

                {/* Right panel */}
                <div className="flex flex-1 flex-col overflow-hidden">
                    <ErrorBoundary>
                        {renderComponent(componentPayload)}
                    </ErrorBoundary>
                </div>
            </div>
        </div>
    );
}
