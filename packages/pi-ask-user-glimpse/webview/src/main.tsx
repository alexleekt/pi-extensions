import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import ErrorBoundary from "./components/ErrorBoundary";
import { SettingsProvider } from "./util/settings";
import "./index.generated.css";

const raw = (window as unknown as Record<string, unknown>).__ASK_USER_PAYLOAD__;
const payload = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};

const rootEl = document.getElementById("root");
if (!rootEl) {
    document.body.innerHTML = '<div style="padding:20px;color:red">Error: #root element not found</div>';
    throw new Error("#root element not found");
}

ReactDOM.createRoot(rootEl).render(
    <React.StrictMode>
        <ErrorBoundary>
            <SettingsProvider
                initialTheme={(payload.theme as "light" | "dark" | "system") ?? undefined}
                initialAnimationLevel={(payload.animationLevel as "none" | "minimal" | "all") ?? undefined}
            >
                <App />
            </SettingsProvider>
        </ErrorBoundary>
    </React.StrictMode>,
);
