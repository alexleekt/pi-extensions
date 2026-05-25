import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { readFile, access, mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { homedir } from "node:os";
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

// Layered model discovery: A + B + C
// A: Hardcoded registry for known models (fallback)
const KNOWN_MODEL_REGISTRY: Record<string, {
  contextWindow: number;
  maxTokens: number;
  reasoning: boolean;
  input: Array<"text" | "image">;
  cost: { input: number; output: number; cacheRead: number; cacheWrite: number };
}> = {
  "anthropic/claude-sonnet-4-20250514": {
    contextWindow: 200_000,
    maxTokens: 16_384,
    reasoning: false,
    input: ["text", "image"],
    cost: { input: 3, output: 15, cacheRead: 0.3, cacheWrite: 3.75 },
  },
  "anthropic/claude-opus-4-20250514": {
    contextWindow: 200_000,
    maxTokens: 16_384,
    reasoning: false,
    input: ["text", "image"],
    cost: { input: 15, output: 75, cacheRead: 1.5, cacheWrite: 18.75 },
  },
  "openai/gpt-4o": {
    contextWindow: 128_000,
    maxTokens: 16_384,
    reasoning: false,
    input: ["text", "image"],
    cost: { input: 2.5, output: 10, cacheRead: 1.25, cacheWrite: 0 },
  },
  "openai/gpt-4o-mini": {
    contextWindow: 128_000,
    maxTokens: 16_384,
    reasoning: false,
    input: ["text", "image"],
    cost: { input: 0.15, output: 0.6, cacheRead: 0.075, cacheWrite: 0 },
  },
};

// Static safe defaults (final fallback)
const STATIC_DEFAULTS = {
  contextWindow: 128_000,
  maxTokens: 16_384,
  reasoning: false,
  input: ["text", "image"] as Array<"text" | "image">,
  cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
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
  cost?: { input?: number; output?: number; cacheRead?: number; cacheWrite?: number };
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
    cost?: { input?: number; output?: number; cache_read?: number; cache_write?: number };
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

function normalizeConfig(raw: { instances?: Record<string, unknown> }): InstancesConfig {
  const instances: Record<string, InstanceConfig> = {};
  if (!raw.instances) return { instances };

  for (const [name, instRaw] of Object.entries(raw.instances)) {
    if (typeof instRaw !== "object" || instRaw === null) continue;
    const inst = instRaw as Record<string, unknown>;

    const instance: InstanceConfig = {
      url: typeof inst.url === "string" ? inst.url : "",
    };

    if (typeof inst.context_window === "number") instance.contextWindow = inst.context_window;
    if (typeof inst.max_tokens === "number") instance.maxTokens = inst.max_tokens;
    if (typeof inst.reasoning === "boolean") instance.reasoning = inst.reasoning;
    if (Array.isArray(inst.input)) {
      instance.input = inst.input.filter((x): x is "text" | "image" =>
        x === "text" || x === "image"
      );
    }
    if (typeof inst.cost_input === "number") {
      instance.cost = { ...instance.cost, input: inst.cost_input };
    }
    if (typeof inst.cost_output === "number") {
      instance.cost = { ...instance.cost, output: inst.cost_output };
    }
    if (typeof inst.cost_cache_read === "number") {
      instance.cost = { ...instance.cost, cacheRead: inst.cost_cache_read };
    }
    if (typeof inst.cost_cache_write === "number") {
      instance.cost = { ...instance.cost, cacheWrite: inst.cost_cache_write };
    }

    instances[name] = instance;
  }

  return { instances };
}

async function ensureConfig(): Promise<InstancesConfig> {
  try {
    await access(CONFIG_PATH);
    const text = await readFile(CONFIG_PATH, "utf8");
    const parsed = YAML.parse(text) as { instances?: Record<string, unknown> };
    return normalizeConfig(parsed);
  } catch (err) {
    if (err instanceof Error && "code" in err && (err as NodeJS.ErrnoException).code === "ENOENT") {
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
// Model discovery (layered: C → A → B → static defaults + overrides)
// ---------------------------------------------------------------------------

async function discoverModelSpecs(baseUrl: string, config: InstanceConfig): Promise<{
  contextWindow: number;
  maxTokens: number;
  reasoning: boolean;
  input: Array<"text" | "image">;
  cost: { input: number; output: number; cacheRead: number; cacheWrite: number };
  source: string;
  targetModel?: string;
}> {
  // Layer 1 (C): LiteLLM /v1/models with model_info
  try {
    const response = await fetch(`${baseUrl}/v1/models`, { signal: AbortSignal.timeout(3000) });
    if (response.ok) {
      const data = (await response.json()) as { data?: LiteLLMModel[] };
      const model = data.data?.find((m) => m.id === "singularity");
      if (model?.model_info) {
        const info = model.model_info;
        return {
          contextWindow: info.context_window ?? STATIC_DEFAULTS.contextWindow,
          maxTokens: info.max_tokens ?? STATIC_DEFAULTS.maxTokens,
          reasoning: STATIC_DEFAULTS.reasoning,
          input: info.supports_vision ? ["text", "image"] : ["text"],
          cost: { ...STATIC_DEFAULTS.cost },
          source: "litellm-model-info",
        };
      }
    }
  } catch {
    // Fall through
  }

  // Layer 2 (A): Event Horizon /health enrichment
  try {
    const response = await fetch(`${baseUrl}/health`, { signal: AbortSignal.timeout(3000) });
    if (response.ok) {
      const data = (await response.json()) as HealthResponse;
      const target = data.target_model;
      if (target) {
        // Layer 2b (B): Hardcoded registry lookup
        const registered = KNOWN_MODEL_REGISTRY[target];
        if (registered) {
          return {
            ...registered,
            source: `registry:${target}`,
            targetModel: target,
          };
        }
        // Partial enrichment from /health model_info
        if (data.model_info) {
          const info = data.model_info;
          const cost = info.cost
            ? {
                input: info.cost.input ?? STATIC_DEFAULTS.cost.input,
                output: info.cost.output ?? STATIC_DEFAULTS.cost.output,
                cacheRead: info.cost.cache_read ?? STATIC_DEFAULTS.cost.cacheRead,
                cacheWrite: info.cost.cache_write ?? STATIC_DEFAULTS.cost.cacheWrite,
              }
            : { ...STATIC_DEFAULTS.cost };
          return {
            contextWindow: info.context_window ?? STATIC_DEFAULTS.contextWindow,
            maxTokens: info.max_tokens ?? STATIC_DEFAULTS.maxTokens,
            reasoning: STATIC_DEFAULTS.reasoning,
            input: info.supports_vision ? ["text", "image"] : ["text"],
            cost,
            source: "health-model-info",
            targetModel: target,
          };
        }
      }
    }
  } catch {
    // Fall through
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
      contextWindow: config.contextWindow ?? STATIC_DEFAULTS.contextWindow,
      maxTokens: config.maxTokens ?? STATIC_DEFAULTS.maxTokens,
      reasoning: config.reasoning ?? STATIC_DEFAULTS.reasoning,
      input: config.input ?? STATIC_DEFAULTS.input,
      cost: {
        input: config.cost?.input ?? STATIC_DEFAULTS.cost.input,
        output: config.cost?.output ?? STATIC_DEFAULTS.cost.output,
        cacheRead: config.cost?.cacheRead ?? STATIC_DEFAULTS.cost.cacheRead,
        cacheWrite: config.cost?.cacheWrite ?? STATIC_DEFAULTS.cost.cacheWrite,
      },
      source: "instances.yaml",
    };
  }

  // Layer 4: static defaults
  return { ...STATIC_DEFAULTS, source: "static-defaults" };
}

// ---------------------------------------------------------------------------
// Health check
// ---------------------------------------------------------------------------

async function checkInstance(name: string, url: string): Promise<{
  reachable: boolean;
  targetModel?: string;
  litellmStatus?: string;
  error?: string;
}> {
  try {
    const response = await fetch(`${url}/health`, { signal: AbortSignal.timeout(5000) });
    if (!response.ok) {
      return { reachable: false, error: `HTTP ${response.status}` };
    }
    const data = (await response.json()) as HealthResponse;
    const litellmOk = data.litellm?.status === "ok";
    return {
      reachable: litellmOk,
      targetModel: data.target_model,
      litellmStatus: data.litellm?.status,
      error: litellmOk ? undefined : `LiteLLM: ${data.litellm?.status ?? "unknown"}`,
    };
  } catch (err) {
    return { reachable: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// ---------------------------------------------------------------------------
// Extension factory
// ---------------------------------------------------------------------------

export default async function (pi: ExtensionAPI) {
  const config = await ensureConfig();
  const createdDefault = Object.keys(config.instances).length === 1 && config.instances.local?.url === DEFAULT_INSTANCE.url;

  // Register providers
  for (const [name, instance] of Object.entries(config.instances)) {
    const baseUrl = instance.url.replace(/\/$/, "");
    const specs = await discoverModelSpecs(baseUrl, instance);
    const providerName = `event-horizon/${name}`;
    const upstreamTag = specs.targetModel ? ` — ${specs.targetModel}` : "";

    pi.registerProvider(providerName, {
      name: `Event Horizon (${name})`,
      baseUrl: `${baseUrl}/v1`,
      apiKey: "EVENTHORIZON_API_KEY",
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
      console.log(`[event-horizon] Registered ${providerName} → ${baseUrl} (specs from ${specs.source})`);
    }
  }

  // Notify if we auto-created the config
  pi.on("session_start", async (_event, ctx) => {
    if (createdDefault) {
      ctx.ui.notify(
        `Event Horizon: created default config at ${CONFIG_PATH}`,
        "info"
      );
    }
  });

  // Status command
  pi.registerCommand("event-horizon", {
    description: "Event Horizon proxy status and configuration",
    handler: async (_args, ctx) => {
      const { Text } = await import("@earendil-works/pi-tui");

      // Re-read config so the command reflects current file state
      const freshConfig = await ensureConfig();
      const results = await Promise.all(
        Object.entries(freshConfig.instances).map(async ([name, instance]) => {
          const check = await checkInstance(name, instance.url);
          return { name, ...check };
        })
      );

      const lines: string[] = [];
      lines.push(ctx.ui.theme.bold("Event Horizon Instances"));
      lines.push("");

      const online = results.filter((r) => r.reachable).length;

      for (const r of results) {
        const bullet = r.reachable
          ? ctx.ui.theme.fg("success", "●")
          : ctx.ui.theme.fg("error", "●");
        const state = r.reachable
          ? ctx.ui.theme.fg("success", "online")
          : ctx.ui.theme.fg("error", "offline");
        lines.push(`  ${bullet} ${ctx.ui.theme.bold(r.name)}  ${state}`);

        if (r.targetModel) {
          lines.push(`    → ${r.targetModel}`);
        } else if (r.error) {
          lines.push(`    → ${ctx.ui.theme.fg("warning", r.error)}`);
        } else {
          lines.push(`    → ${ctx.ui.theme.fg("dim", "unknown target")}`);
        }
      }

      lines.push("");
      lines.push(`${online}/${results.length} instances online`);
      lines.push(ctx.ui.theme.fg("dim", `Config: ${CONFIG_PATH}`));

      ctx.ui.notify(lines.join("\n"), "info");
    },
  });
}
