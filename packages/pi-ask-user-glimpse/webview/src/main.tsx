import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import ErrorBoundary from "./components/ErrorBoundary";
import { SettingsProvider } from "./util/settings";
import { sendToGlimpseSafe } from "./util/glimpse";
import { getThemeFamilyId } from "./themes";
import type { ThemeId } from "./themes";
import "./index.generated.css";

const raw = (window as unknown as Record<string, unknown>).__ASK_USER_PAYLOAD__;

/** Lightweight runtime validation for the ask_user payload.
 *  Ensures the payload has a recognized type before rendering.
 */
function validatePayload(raw: unknown): Record<string, unknown> | null {
    if (!raw || typeof raw !== "object") return null;
    const payload = raw as Record<string, unknown>;
    const validTypes = ["single-select", "multi-select", "freeform", "questionnaire"];
    if (!validTypes.includes(payload.type as string)) return null;
    return payload;
}

const payload = validatePayload(raw);

const rootEl = document.getElementById("root");
if (!rootEl) {
    document.body.innerHTML = '<div style="padding:20px;color:red">Error: #root element not found</div>';
    throw new Error("#root element not found");
}

if (!payload) {
    const errorMessage = "Invalid payload: missing or unrecognized type field";
    document.body.innerHTML = '<div style="padding:20px;color:red">Error: Invalid ask_user payload</div>';
    sendToGlimpseSafe({ __error: true, message: errorMessage });
    throw new Error(errorMessage);
}

const initialThemeName = (payload.theme as string | undefined);
const initialThemeFamily = initialThemeName
    ? getThemeFamilyId(initialThemeName as ThemeId) ?? undefined
    : undefined;
const initialMode = (payload.mode as "light" | "dark" | "system" | undefined) ?? "system";

ReactDOM.createRoot(rootEl).render(
    <React.StrictMode>
        <ErrorBoundary>
            <SettingsProvider
                initialThemeFamily={initialThemeFamily}
                initialMode={initialMode}
                initialAnimationLevel={(payload.animationLevel as "none" | "minimal" | "all") ?? undefined}
            >
                <App />
            </SettingsProvider>
        </ErrorBoundary>
    </React.StrictMode>,
);
