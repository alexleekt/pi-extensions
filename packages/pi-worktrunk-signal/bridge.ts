import { exec } from "node:child_process";
import { createConnection } from "node:net";

/**
 * Herdr-Worktrunk Marker Bridge
 *
 * Polls herdr agent status and syncs it to worktrunk markers.
 * Maps:
 *   working  → 🤖
 *   idle     → 💬
 *   done     → 💬
 *   blocked  → ⏸️
 *
 * Run: node bridge.ts (or ts-node bridge.ts, or bun bridge.ts)
 * Requires: HERDR_SOCKET_PATH, HERDR_PANE_ID, and a git repo.
 */

const HERDR_SOCKET_PATH = process.env.HERDR_SOCKET_PATH;
const POLL_INTERVAL_MS = 5000;

/** Markers per herdr agent status. */
const STATUS_MARKERS: Record<string, string> = {
    working: "🤖",
    idle: "💬",
    done: "💬",
    blocked: "⏸️",
};

interface HerdrPane {
    pane_id?: string;
    agent_status?: string;
    cwd?: string;
}

interface HerdrResponse {
    result?: {
        panes?: HerdrPane[];
    };
}

function herdrRequest(method: string, params: Record<string, unknown>): Promise<HerdrResponse | null> {
    if (!HERDR_SOCKET_PATH) {
        console.error("HERDR_SOCKET_PATH not set. Run inside herdr.");
        return Promise.resolve(null);
    }

    return new Promise((resolve) => {
        let done = false;
        let buf = "";
        const finish = (result: HerdrResponse | null = null) => {
            if (done) return;
            done = true;
            clearTimeout(timer);
            socket.destroy();
            resolve(result);
        };

        const socket = createConnection(HERDR_SOCKET_PATH);
        socket.on("error", () => finish());
        socket.on("connect", () => {
            const id = `bridge:${Date.now()}`;
            socket.write(`${JSON.stringify({ id, method, params })}\n`);
        });
        socket.on("data", (chunk) => {
            buf += chunk.toString();
            const lineEnd = buf.indexOf("\n");
            if (lineEnd === -1) return;
            try {
                const resp = JSON.parse(buf.slice(0, lineEnd)) as HerdrResponse;
                finish(resp);
            } catch {
                finish();
            }
        });
        socket.on("end", () => finish());
        const timer = setTimeout(() => finish(), 1000);
        timer.unref?.();
    });
}

function getBranchFromCwd(cwd: string): Promise<string | null> {
    return new Promise((resolve) => {
        exec(
            `git -C "${cwd}" branch --show-current 2>/dev/null`,
            { encoding: "utf-8" },
            (err, stdout) => {
                if (err) return resolve(null);
                resolve(stdout.trim() || null);
            },
        );
    });
}

function setMarker(cwd: string, branch: string, marker: string): Promise<void> {
    return new Promise((resolve) => {
        const payload = JSON.stringify({ marker, set_at: Date.now() });
        exec(
            `git config --global worktrunk.state.${branch}.marker '${payload}'`,
            () => resolve(), // ignore errors
        );
    });
}

function clearMarker(cwd: string, branch: string): Promise<void> {
    return new Promise((resolve) => {
        exec(
            `git config --global --unset worktrunk.state.${branch}.marker 2>/dev/null || true`,
            () => resolve(),
        );
    });
}

let lastBranchMarkers = new Map<string, string>();

async function pollAndSync(): Promise<void> {
    const resp = await herdrRequest("pane.list", {});
    const panes = resp?.result?.panes || [];

    const currentMarkers = new Map<string, string>();

    for (const pane of panes) {
        const status = pane.agent_status;
        const cwd = pane.cwd;
        if (!status || !cwd) continue;

        const marker = STATUS_MARKERS[status];
        if (!marker) continue;

        const branch = await getBranchFromCwd(cwd);
        if (!branch) continue;

        // Only update if changed
        const last = lastBranchMarkers.get(branch);
        if (last !== marker) {
            await setMarker(cwd, branch, marker);
            console.log(`[${new Date().toISOString()}] ${branch}: ${status} → ${marker}`);
        }
        currentMarkers.set(branch, marker);
    }

    // Clear markers for branches that no longer have active panes
    for (const [branch, _marker] of lastBranchMarkers) {
        if (!currentMarkers.has(branch)) {
            // Find a representative cwd to clear from
            const pane = panes.find((p) => p.cwd);
            if (pane?.cwd) {
                await clearMarker(pane.cwd, branch);
                console.log(`[${new Date().toISOString()}] ${branch}: cleared (no active pane)`);
            }
        }
    }

    lastBranchMarkers = currentMarkers;
}

async function main(): Promise<void> {
    console.log("Herdr-Worktrunk Marker Bridge starting…");
    console.log(`Polling every ${POLL_INTERVAL_MS}ms`);

    // Initial sync
    await pollAndSync();

    // Periodic sync
    setInterval(() => {
        void pollAndSync();
    }, POLL_INTERVAL_MS);
}

main().catch((err) => {
    console.error("Bridge crashed:", err);
    process.exit(1);
});
