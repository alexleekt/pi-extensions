// pi-herdr-tab-sync: sync pi session name → herdr tab label
// Only activates inside herdr-managed panes (HERDR_ENV=1).
// Triggers on: session_start (resume), agent_start (picks up /name changes).
// Does nothing if the session has no name.

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { createConnection } from "node:net";

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

    const socket = createConnection(socketPath!);
    socket.on("error", () => finish());
    socket.on("connect", () => {
      const id = `pi-herdr-tab:${Date.now()}`;
      socket.write(`${JSON.stringify({ id, method, params })}\n`);
    });
    socket.on("data", (chunk) => {
      buf += chunk.toString();
      if (buf.includes("\n")) {
        try {
          const resp = JSON.parse(buf.split("\n")[0]);
          finish(resp.result ?? null);
        } catch {
          finish();
        }
      }
    });
    socket.on("end", () => finish());
    const timer = setTimeout(() => finish(), 1000);
    timer.unref?.();
  });
}

async function renameTab(label: string): Promise<void> {
  const result = await herdrRequest("pane.get", { pane_id: paneId! });
  const tabId = (result as { pane?: { tab_id?: string } })?.pane?.tab_id;
  if (!tabId) return;
  await herdrRequest("tab.rename", { tab_id: tabId, label });
}

export default function (pi: ExtensionAPI) {
  if (!enabled()) return;

  let lastSynced: string | undefined;

  function sync() {
    const name = pi.getSessionName();
    if (!name || name === lastSynced) return;
    lastSynced = name;
    void renameTab(name);
  }

  pi.on("session_start", () => sync());
  pi.on("agent_start", () => sync());
}
