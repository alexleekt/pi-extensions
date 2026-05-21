// pi-herdr-tab-sync: sync pi session name / heading topic → herdr tab label
// Only activates inside herdr-managed panes (HERDR_ENV=1).
// Triggers on: session_start (resume), agent_start (picks up /name changes),
//             heading:state (when pi-heading broadcasts a topic).
// Falls back to session name when no heading topic is available.

import { createConnection } from "node:net";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const HERDR_ENV = process.env.HERDR_ENV;
const socketPath = process.env.HERDR_SOCKET_PATH;
const paneId = process.env.HERDR_PANE_ID;

function enabled() {
    return HERDR_ENV === "1" && !!socketPath && !!paneId;
}

function herdrRequest(
    method: string,
    params: Record<string, unknown>,
): Promise<Record<string, unknown> | null> {
    if (!socketPath) return Promise.resolve(null);

    return new Promise((resolve) => {
        let done = false;
        let buf = "";
        const finish = (result: Record<string, unknown> | null = null) => {
            if (done) return;
            done = true;
            clearTimeout(timer);
            socket.destroy();
            resolve(result);
        };

        const socket = createConnection(socketPath);
        socket.on("error", () => finish());
        socket.on("connect", () => {
            const id = `pi-herdr-tab:${Date.now()}`;
            socket.write(`${JSON.stringify({ id, method, params })}\n`);
        });
        socket.on("data", (chunk) => {
            buf += chunk.toString();
            const lineEnd = buf.indexOf("\n");
            if (lineEnd === -1) return;
            try {
                const resp = JSON.parse(buf.slice(0, lineEnd));
                finish(resp.result ?? null);
            } catch {
                finish();
            }
        });
        socket.on("end", () => finish());
        const timer = setTimeout(() => finish(), 1000);
        timer.unref?.();
    });
}

async function renameTab(label: string): Promise<void> {
    if (!paneId) return;
    const result = await herdrRequest("pane.get", { pane_id: paneId });
    const tabId = (result as { pane?: { tab_id?: string } })?.pane?.tab_id;
    if (!tabId) return;
    await herdrRequest("tab.rename", { tab_id: tabId, label });
}

interface HeadingState {
    topic?: string;
}

export default function (pi: ExtensionAPI) {
    if (!enabled()) return;

    let lastSynced: string | undefined;
    let currentTopic: string | undefined;

    function renameIfChanged(label: string) {
        if (label === lastSynced) return;
        lastSynced = label;
        void renameTab(label);
    }

    function updateLabel() {
        const name = currentTopic || pi.getSessionName();
        if (!name) return;
        renameIfChanged(name);
    }

    pi.on("session_start", () => updateLabel());
    pi.on("agent_start", () => updateLabel());

    pi.events?.on("heading:state", (payload: unknown) => {
        const state = payload as HeadingState;
        if (!state?.topic) {
            currentTopic = undefined;
            updateLabel();
            return;
        }
        currentTopic = state.topic;
        renameIfChanged(state.topic);
    });
}
