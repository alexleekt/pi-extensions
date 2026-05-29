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

const DEFAULT_INSTANCE = {
    url: "http://localhost:4000",
};

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
                instances: { local: { ...DEFAULT_INSTANCE } },
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
            baseUrl: `${baseUrl}/v1`,
            apiKey: "dummy",  // proxy handles auth internally; not used
            api: "openai-completions",
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
            console.log(
                `[event-horizon] Registered ${providerName} → ${baseUrl} (specs from ${specs.source})`,
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

    // Clear the status widget when the user sends any input
    pi.on("input", async (_event, ctx) => {
        ctx.ui.setWidget("pi-event-horizon:status", undefined);
    });

    // Status command
    pi.registerCommand("event-horizon", {
        description: "Event Horizon proxy status and configuration",
        handler: async (_args, ctx) => {
            const theme = ctx.ui.theme;

            // 1. Clear any stale widget
            ctx.ui.setWidget("pi-event-horizon:status", undefined);

            // 2. Read fresh config
            const freshConfig = await ensureConfig();
            const instances = Object.entries(freshConfig.instances);

            interface RowState {
                name: string;
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

            const rows: RowState[] = instances.map(([name]) => ({ name }));

            const renderWidget = (): string[] => {
                const maxNameLen = Math.max(...rows.map((r) => r.name.length));
                const online = rows.filter((r) => r.reachable === true).length;
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

                    // Left-pad name for right-justification: <left-pad>rudolph ● online
                    const nameLeftPad = " ".repeat(maxNameLen - r.name.length);

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

                    lines.push(
                        `  ${nameLeftPad}${theme.bold(r.name)} ${dot} ${statusStr}  ${targetPart}${costPart}`,
                    );
                }

                lines.push("");
                lines.push(`${online}/${rows.length} instances online`);
                lines.push(theme.fg("dim", `Config: ${CONFIG_PATH}`));

                return lines;
            };

            const updateWidget = () => {
                ctx.ui.setWidget("pi-event-horizon:status", renderWidget());
            };

            // Show initial "checking..." widget
            updateWidget();

            // 4. Fire checks in parallel; update widget as each resolves
            const promises = instances.map(
                async ([name, instance], index) => {
                    const baseUrl = instance.url.replace(/\/$/, "");
                    const check = await checkInstance(name, instance.url);
                    const specs = await discoverModelSpecs(
                        baseUrl,
                        instance,
                        check.response,
                    );

                    rows[index].reachable = check.reachable;
                    rows[index].targetModel = check.targetModel;
                    rows[index].error = check.error;
                    rows[index].specs = specs;

                    updateWidget();
                },
            );

            await Promise.allSettled(promises);
        },
    });
}
