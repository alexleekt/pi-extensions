import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import YAML from "yaml";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const CONFIG_DIR = join(homedir(), ".pi", "agent", "config", "event-horizon");
const CONFIG_PATH = join(CONFIG_DIR, "instances.yaml");

const DEBUG = process.env.EVENTHORIZON_DEBUG === "1";

/** Widget key for the /event-horizon status surface. */
const STATUS_WIDGET_KEY = "pi-event-horizon:status";

const DEFAULT_INSTANCE = {
    url: "http://localhost:4000",
    api: "openai-completions" as const,
};

/** Valid API formats for Event Horizon endpoints. */
const VALID_API_TYPES = [
    "openai-completions",
    "anthropic-messages",
    "openai-responses",
] as const;
type ValidApiType = (typeof VALID_API_TYPES)[number];

// Fallback spec for when the proxy is unreachable — reflects modern model baselines.
// Cost is a guess: Claude Sonnet 4 tier (common workhorse pricing).
const MODERN_FALLBACK = {
    contextWindow: 256_000,
    maxTokens: 32_768,
    reasoning: false,
    input: ["text", "image"] as Array<"text" | "image">,
    cost: { input: 3, output: 15, cacheRead: 0.3, cacheWrite: 3.75 },
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface InstanceConfig {
    url: string;
    api?: ValidApiType;
    contextWindow?: number;
    maxTokens?: number;
    reasoning?: boolean;
    input?: Array<"text" | "image">;
    cost?: {
        input?: number;
        output?: number;
        cacheRead?: number;
        cacheWrite?: number;
    };
}

interface InstancesConfig {
    instances: Record<string, InstanceConfig>;
}

interface HealthResponse {
    status: string;
    proxy: string;
    target_model?: string;
    model_info?: {
        context_window?: number;
        max_tokens?: number;
        supports_vision?: boolean;
        cost?: {
            input?: number;
            output?: number;
            cache_read?: number;
            cache_write?: number;
        };
    };
    available_models?: string[];
    litellm: { status: string; code?: number; error?: string };
}

interface LiteLLMModel {
    id: string;
    object?: string;
    model_info?: {
        context_window?: number;
        max_tokens?: number;
        supports_vision?: boolean;
    };
}

// ---------------------------------------------------------------------------
// Config I/O
// ---------------------------------------------------------------------------

function normalizeConfig(raw: {
    instances?: Record<string, unknown>;
}): InstancesConfig {
    const instances: Record<string, InstanceConfig> = {};
    if (!raw.instances) return { instances };

    for (const [name, instRaw] of Object.entries(raw.instances)) {
        if (typeof instRaw !== "object" || instRaw === null) continue;
        const inst = instRaw as Record<string, unknown>;

        const instance: InstanceConfig = {
            url: typeof inst.url === "string" ? inst.url : "",
        };

        if (typeof inst.api === "string" &&
            (VALID_API_TYPES as readonly string[]).includes(inst.api)) {
            instance.api = inst.api as ValidApiType;
        }

        if (typeof inst.context_window === "number")
            instance.contextWindow = inst.context_window;
        if (typeof inst.max_tokens === "number")
            instance.maxTokens = inst.max_tokens;
        if (typeof inst.reasoning === "boolean")
            instance.reasoning = inst.reasoning;
        if (Array.isArray(inst.input)) {
            instance.input = inst.input.filter(
                (x): x is "text" | "image" => x === "text" || x === "image",
            );
        }
        if (typeof inst.cost_input === "number") {
            instance.cost = { ...instance.cost, input: inst.cost_input };
        }
        if (typeof inst.cost_output === "number") {
            instance.cost = { ...instance.cost, output: inst.cost_output };
        }
        if (typeof inst.cost_cache_read === "number") {
            instance.cost = {
                ...instance.cost,
                cacheRead: inst.cost_cache_read,
            };
        }
        if (typeof inst.cost_cache_write === "number") {
            instance.cost = {
                ...instance.cost,
                cacheWrite: inst.cost_cache_write,
            };
        }

        instances[name] = instance;
    }

    return { instances };
}

async function ensureConfig(): Promise<InstancesConfig> {
    try {
        await access(CONFIG_PATH);
        const text = await readFile(CONFIG_PATH, "utf8");
        const parsed = YAML.parse(text) as {
            instances?: Record<string, unknown>;
        };
        return normalizeConfig(parsed);
    } catch (err) {
        if (
            err instanceof Error &&
            "code" in err &&
            (err as NodeJS.ErrnoException).code === "ENOENT"
        ) {
            // Auto-create with default only when config genuinely doesn't exist
            await mkdir(CONFIG_DIR, { recursive: true });
            const defaultConfig: InstancesConfig = {
                instances: { local: { url: DEFAULT_INSTANCE.url } },
            };
            await writeFile(CONFIG_PATH, YAML.stringify(defaultConfig), "utf8");
            return defaultConfig;
        }
        throw err;
    }
}

// ---------------------------------------------------------------------------
// Model discovery (layered: /v1/models → /health → instances.yaml → fallback)
// ---------------------------------------------------------------------------

async function discoverModelSpecs(
    baseUrl: string,
    config: InstanceConfig,
    healthResponse?: HealthResponse,
): Promise<{
    contextWindow: number;
    maxTokens: number;
    reasoning: boolean;
    input: Array<"text" | "image">;
    cost: {
        input: number;
        output: number;
        cacheRead: number;
        cacheWrite: number;
    };
    source: string;
    targetModel?: string;
}> {
    // Shortcut Layer 2: use pre-fetched health response
    if (healthResponse?.target_model && healthResponse.model_info) {
        const info = healthResponse.model_info;
        const cost = info.cost
            ? {
                  input: info.cost.input ?? MODERN_FALLBACK.cost.input,
                  output: info.cost.output ?? MODERN_FALLBACK.cost.output,
                  cacheRead:
                      info.cost.cache_read ?? MODERN_FALLBACK.cost.cacheRead,
                  cacheWrite:
                      info.cost.cache_write ?? MODERN_FALLBACK.cost.cacheWrite,
              }
            : { ...MODERN_FALLBACK.cost };
        return {
            contextWindow: info.context_window ?? MODERN_FALLBACK.contextWindow,
            maxTokens: info.max_tokens ?? MODERN_FALLBACK.maxTokens,
            reasoning: MODERN_FALLBACK.reasoning,
            input: info.supports_vision ? ["text", "image"] : ["text"],
            cost,
            source: "health-model-info",
            targetModel: healthResponse.target_model,
        };
    }

    // Layer 1: LiteLLM /v1/models with model_info
    try {
        const response = await fetch(`${baseUrl}/v1/models`, {
            signal: AbortSignal.timeout(3000),
        });
        if (response.ok) {
            const data = (await response.json()) as { data?: LiteLLMModel[] };
            const model = data.data?.find((m) => m.id === "singularity");
            if (
                model?.model_info?.context_window ||
                model?.model_info?.max_tokens
            ) {
                const info = model.model_info;
                return {
                    contextWindow:
                        info.context_window ?? MODERN_FALLBACK.contextWindow,
                    maxTokens: info.max_tokens ?? MODERN_FALLBACK.maxTokens,
                    reasoning: MODERN_FALLBACK.reasoning,
                    input: info.supports_vision ? ["text", "image"] : ["text"],
                    cost: { ...MODERN_FALLBACK.cost },
                    source: "litellm-model-info",
                };
            }
        }
    } catch {
        // Fall through
    }

    // Layer 2: Event Horizon /health enrichment (only if not pre-fetched)
    if (!healthResponse) {
        try {
            const response = await fetch(`${baseUrl}/health`, {
                signal: AbortSignal.timeout(3000),
            });
            if (response.ok) {
                const data = (await response.json()) as HealthResponse;
                const target = data.target_model;
                if (target && data.model_info) {
                    const info = data.model_info;
                    const cost = info.cost
                        ? {
                              input:
                                  info.cost.input ?? MODERN_FALLBACK.cost.input,
                              output:
                                  info.cost.output ??
                                  MODERN_FALLBACK.cost.output,
                              cacheRead:
                                  info.cost.cache_read ??
                                  MODERN_FALLBACK.cost.cacheRead,
                              cacheWrite:
                                  info.cost.cache_write ??
                                  MODERN_FALLBACK.cost.cacheWrite,
                          }
                        : { ...MODERN_FALLBACK.cost };
                    return {
                        contextWindow:
                            info.context_window ??
                            MODERN_FALLBACK.contextWindow,
                        maxTokens: info.max_tokens ?? MODERN_FALLBACK.maxTokens,
                        reasoning: MODERN_FALLBACK.reasoning,
                        input: info.supports_vision
                            ? ["text", "image"]
                            : ["text"],
                        cost,
                        source: "health-model-info",
                        targetModel: target,
                    };
                }
            }
        } catch {
            // Fall through
        }
    }

    // Layer 3: instances.yaml overrides
    if (
        config.contextWindow !== undefined ||
        config.maxTokens !== undefined ||
        config.reasoning !== undefined ||
        config.input !== undefined ||
        config.cost !== undefined
    ) {
        return {
            contextWindow:
                config.contextWindow ?? MODERN_FALLBACK.contextWindow,
            maxTokens: config.maxTokens ?? MODERN_FALLBACK.maxTokens,
            reasoning: config.reasoning ?? MODERN_FALLBACK.reasoning,
            input: config.input ?? MODERN_FALLBACK.input,
            cost: {
                input: config.cost?.input ?? MODERN_FALLBACK.cost.input,
                output: config.cost?.output ?? MODERN_FALLBACK.cost.output,
                cacheRead:
                    config.cost?.cacheRead ?? MODERN_FALLBACK.cost.cacheRead,
                cacheWrite:
                    config.cost?.cacheWrite ?? MODERN_FALLBACK.cost.cacheWrite,
            },
            source: "instances.yaml",
        };
    }

    // Layer 4: modern fallback (proxy unreachable)
    return { ...MODERN_FALLBACK, source: "modern-fallback" };
}

// ---------------------------------------------------------------------------
// Health check
// ---------------------------------------------------------------------------

async function checkInstance(
    _name: string,
    url: string,
): Promise<{
    response?: HealthResponse;
    reachable: boolean;
    targetModel?: string;
    litellmStatus?: string;
    error?: string;
}> {
    try {
        const response = await fetch(`${url}/health`, {
            signal: AbortSignal.timeout(3000),
        });
        if (!response.ok) {
            return { reachable: false, error: `HTTP ${response.status}` };
        }
        const data = (await response.json()) as HealthResponse;
        const litellmOk = data.litellm?.status === "ok";
        return {
            response: data,
            reachable: litellmOk,
            targetModel: data.target_model,
            litellmStatus: data.litellm?.status,
            error: litellmOk
                ? undefined
                : `LiteLLM: ${data.litellm?.status ?? "unknown"}`,
        };
    } catch (err) {
        return {
            reachable: false,
            error: err instanceof Error ? err.message : String(err),
        };
    }
}

// ---------------------------------------------------------------------------
// Extension factory
// ---------------------------------------------------------------------------

/**
 * AbortController for the currently in-flight /event-horizon status checks.
 * Held at module scope so a re-invocation of the command can cancel the prior
 * run's per-instance promises before they call updateWidget().
 */
let currentAbort: AbortController | null = null;

export default async function (pi: ExtensionAPI) {
    const config = await ensureConfig();
    const createdDefault =
        Object.keys(config.instances).length === 1 &&
        config.instances.local?.url === DEFAULT_INSTANCE.url;

    // Register providers
    for (const [name, instance] of Object.entries(config.instances)) {
        const baseUrl = instance.url.replace(/\/$/, "");
        const specs = await discoverModelSpecs(baseUrl, instance);
        const providerName = `event-horizon/${name}`;
        const upstreamTag = specs.targetModel ? ` — ${specs.targetModel}` : "";

        pi.registerProvider(providerName, {
            name: `Event Horizon (${name})`,
            baseUrl,
            apiKey: "dummy",  // proxy handles auth internally; not used
            api: instance.api ?? DEFAULT_INSTANCE.api,
            models: [
                {
                    id: "singularity",
                    name: `Singularity (${name})${upstreamTag}`,
                    reasoning: specs.reasoning,
                    input: specs.input,
                    cost: specs.cost,
                    contextWindow: specs.contextWindow,
                    maxTokens: specs.maxTokens,
                },
            ],
        });

        if (DEBUG) {
            const api = instance.api ?? DEFAULT_INSTANCE.api;
            console.log(
                `[event-horizon] Registered ${providerName} → ${baseUrl} api=${api} (specs from ${specs.source})`,
            );
        }
    }

    // Notify if we auto-created the config
    pi.on("session_start", async (_event, ctx) => {
        if (createdDefault) {
            ctx.ui.notify(
                `Event Horizon: created default config at ${CONFIG_PATH}`,
                "info",
            );
        }
    });

    // Clear the status widget when the user sends any input (defense in depth)
    pi.on("input", async (_event, ctx) => {
        ctx.ui.setWidget(STATUS_WIDGET_KEY, undefined);
    });

    // Dismiss the status widget at the next agent turn boundary.
    // This is the canonical "the user has moved on" signal: as soon as the
    // user starts a new turn, the widget is no longer useful context.
    // No-op if no widget is set.
    pi.on("agent_start", async (_event, ctx) => {
        ctx.ui.setWidget(STATUS_WIDGET_KEY, undefined);
    });

    // Status command
    pi.registerCommand("event-horizon", {
        description: "Event Horizon proxy status and configuration",
        handler: async (args, ctx) => {
            const theme = ctx.ui.theme;
            const trimmed = args.trim();

            // 1. Clear any stale widget and cancel any in-flight checks
            //    from a prior invocation, so a slow prior run can't overwrite
            //    this invocation's row state.
            ctx.ui.setWidget(STATUS_WIDGET_KEY, undefined);
            currentAbort?.abort();
            currentAbort = new AbortController();
            const signal = currentAbort.signal;

            // 2. Read fresh config
            const freshConfig = await ensureConfig();
            const instances = Object.entries(freshConfig.instances);

            // -----------------------------------------------------------------
            // Toggle mode: "<instance> <api>"
            // -----------------------------------------------------------------
            const apiShorthand: Record<string, ValidApiType> = {
                anthropic: "anthropic-messages",
                openai: "openai-completions",
                responses: "openai-responses",
            };
            const parts = trimmed.split(/\s+/);
            if (parts.length === 2 && parts[1] in apiShorthand) {
                const [name, apiShort] = parts;
                const api = apiShorthand[apiShort];
                if (!freshConfig.instances[name]) {
                    ctx.ui.notify(
                        `Unknown instance: ${name}`,
                        "error",
                    );
                    return;
                }
                const currentApi =
                    freshConfig.instances[name].api ??
                    DEFAULT_INSTANCE.api;
                if (currentApi === api) {
                    ctx.ui.notify(
                        `${name} is already using ${api}`,
                        "info",
                    );
                    return;
                }

                // Update config
                freshConfig.instances[name].api = api;
                await writeFile(
                    CONFIG_PATH,
                    YAML.stringify(freshConfig),
                    "utf8",
                );

                // Re-register provider
                const providerName = `event-horizon/${name}`;
                const baseUrl = freshConfig.instances[name].url.replace(
                    /\/$/,
                    "",
                );
                const specs = await discoverModelSpecs(
                    baseUrl,
                    freshConfig.instances[name],
                );
                const upstreamTag = specs.targetModel
                    ? ` — ${specs.targetModel}`
                    : "";
                pi.unregisterProvider(providerName);
                pi.registerProvider(providerName, {
                    name: `Event Horizon (${name})`,
                    baseUrl,
                    apiKey: "dummy",
                    api,
                    models: [
                        {
                            id: "singularity",
                            name: `Singularity (${name})${upstreamTag}`,
                            reasoning: specs.reasoning,
                            input: specs.input,
                            cost: specs.cost,
                            contextWindow: specs.contextWindow,
                            maxTokens: specs.maxTokens,
                        },
                    ],
                });

                ctx.ui.notify(
                    `Switched ${name} to ${api}. Run /model ${providerName} to use it.`,
                    "info",
                );
                return;
            }

            // Show usage hint for malformed toggle
            if (trimmed && parts.length === 2 && !(parts[1] in apiShorthand)) {
                ctx.ui.notify(
                    `Unknown API: ${parts[1]}. Use: anthropic, openai, or responses.`,
                    "error",
                );
                return;
            }

            // -----------------------------------------------------------------
            // Status mode (no args or "<instance>")
            // -----------------------------------------------------------------

            interface RowState {
                name: string;
                api?: ValidApiType;
                reachable?: boolean;
                targetModel?: string;
                error?: string;
                specs?: {
                    cost: {
                        input: number;
                        output: number;
                        cacheRead: number;
                        cacheWrite: number;
                    };
                };
            }

            const rows: RowState[] = instances.map(
                ([name, instance]) => ({
                    name,
                    api: instance.api ?? DEFAULT_INSTANCE.api,
                }),
            );

            const renderWidget = (): string[] => {
                const maxNameLen = Math.max(...rows.map((r) => r.name.length));
                const online = rows.filter(
                    (r) => r.reachable === true,
                ).length;
                const lines: string[] = [];

                lines.push(theme.bold("Event Horizon Instances"));
                lines.push("");

                for (const r of rows) {
                    const stateText =
                        r.reachable === true
                            ? "online"
                            : r.reachable === false
                              ? "offline"
                              : "checking";

                    const dot =
                        r.reachable === true
                            ? theme.fg("success", "●")
                            : r.reachable === false
                              ? theme.fg("error", "●")
                              : theme.fg("dim", "●");

                    const statusStr =
                        r.reachable === true
                            ? theme.fg("success", stateText)
                            : r.reachable === false
                              ? theme.fg("error", stateText)
                              : theme.fg("dim", stateText);

                    const nameLeftPad = " ".repeat(
                        maxNameLen - r.name.length,
                    );

                    let targetPart = "";
                    if (r.targetModel) {
                        targetPart = `→ ${r.targetModel}`;
                    } else if (r.error) {
                        targetPart = `→ ${theme.fg("warning", r.error)}`;
                    } else {
                        targetPart = `→ ${theme.fg("dim", "?")}`;
                    }

                    let costPart = "";
                    if (r.specs) {
                        const c = r.specs.cost;
                        costPart = `  $${c.input.toFixed(2)}/${c.output.toFixed(2)} per 1M (cache $${c.cacheRead.toFixed(2)}/${c.cacheWrite.toFixed(2)})`;
                    }

                    let apiPart = "";
                    if (r.api) {
                        apiPart = theme.fg("dim", `  [${r.api}]`);
                    }

                    lines.push(
                        `  ${nameLeftPad}${theme.bold(r.name)} ${dot} ${statusStr}  ${targetPart}${costPart}${apiPart}`,
                    );
                }

                lines.push("");
                lines.push(`${online}/${rows.length} instances online`);
                lines.push(theme.fg("dim", `Config: ${CONFIG_PATH}`));
                lines.push(
                    theme.fg(
                        "dim",
                        "Toggle: /event-horizon <instance> <anthropic|openai|responses>",
                    ),
                );

                return lines;
            };

            const updateWidget = () => {
                ctx.ui.setWidget("pi-event-horizon:status", renderWidget());
            };

            // Show initial "checking..." widget
            updateWidget();

            // Fire checks in parallel; update widget as each resolves.
            // try/finally ensures we always render the final state (including
            // partial state when some rows are still "checking" at end).
            try {
                const promises = instances.map(
                    async ([name, instance], index) => {
                        // Skip work if a newer invocation has already taken over
                        if (signal.aborted) return;
                        const baseUrl = instance.url.replace(/\/$/, "");
                        const check = await checkInstance(
                            name,
                            instance.url,
                        );
                        if (signal.aborted) return;
                        const specs = await discoverModelSpecs(
                            baseUrl,
                            instance,
                            check.response,
                        );
                        if (signal.aborted) return;

                        rows[index].reachable = check.reachable;
                        rows[index].targetModel = check.targetModel;
                        rows[index].error = check.error;
                        rows[index].specs = specs;

                        updateWidget();
                    },
                );

                await Promise.allSettled(promises);
            } finally {
                updateWidget();
            }
        },
    });
}
