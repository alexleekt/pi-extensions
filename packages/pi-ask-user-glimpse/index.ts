/**
 * pi-ask-user-glimpse — Pi extension that replaces ask_user with native WebView dialogs via glimpseui.
 */

import {
    type CustomJournalEntry,
    isCustomEntry,
} from "@alexleekt/pi-shared/types";

import { StringEnum, Type } from "@earendil-works/pi-ai";
import type {
    ExtensionAPI,
    ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import { defineTool } from "@earendil-works/pi-coding-agent";
import { PROTECTED_ABBREVIATIONS } from "./constants/abbreviations.js";
import { ALL_THEME_NAMES, type AnimationLevel, type ThemeMode, type ThemeName } from "./shared/ask-user.js";
import {
    loadAskUserPrompt,
    loadYoloMandate,
} from "./shared/prompt-loader.js";
import {
    type AskUserMetadata,
    type AskUserParams,
    askUserHandler,
} from "./tool/ask-user.js";

/* ── Module-level reference to ExtensionAPI for tool execute closure ── */
let _pi: ExtensionAPI | undefined;

/* ── Style constants ── */

type StyleMode = "plain" | "yolo";

function findCustomData(
    entries: unknown[],
    customType: string,
): Record<string, unknown> | undefined {
    const entry = entries.find(
        (e): e is CustomJournalEntry =>
            isCustomEntry(e) && e.customType === customType,
    );
    return entry?.data as Record<string, unknown> | undefined;
}

function getStyleMode(entries: unknown[]): StyleMode {
    const data = findCustomData(entries, "ask-user-style");
    const mode = data?.mode;
    if (mode === "plain" || mode === "yolo") {
        return mode;
    }
    return "plain";
}

function getThemeSettings(entries: unknown[]): {
    theme?: ThemeName;
    animationLevel?: AnimationLevel;
} {
    const data = findCustomData(entries, "ask-user-theme");
    const theme = typeof data?.theme === "string" ? data.theme : undefined;
    const animationLevel =
        typeof data?.animationLevel === "string"
            ? data.animationLevel
            : undefined;
    return {
        theme: ALL_THEME_NAMES.includes(theme as ThemeName) ? theme as ThemeName : undefined,
        animationLevel:
            animationLevel === "none" ||
            animationLevel === "minimal" ||
            animationLevel === "all"
                ? animationLevel
                : undefined,
    };
}

/** Extract text blocks from a content array (journal entry). */
function extractTextFromContent(content: unknown): string {
    if (typeof content === "string") return content;
    if (!Array.isArray(content)) return "";
    return content
        .filter(
            (c): c is { type: string; text: string } =>
                typeof c === "object" &&
                c !== null &&
                typeof (c as Record<string, unknown>).type === "string" &&
                typeof (c as Record<string, unknown>).text === "string",
        )
        .map((c) => c.text)
        .join("\n");
}

/* ── Shared helpers for consistent ask_user UX across all entry points ── */

/** Enrich raw ask_user params with persisted theme/animation settings. */
function enrichWithThemeSettings(
    params: AskUserParams,
    entries: unknown[],
): AskUserParams {
    const { theme, animationLevel } = getThemeSettings(entries);
    return { ...params, theme, animationLevel };
}

/** Persist theme/animation changes back to the session journal. */
function saveThemeMetadata(metadata: AskUserMetadata) {
    if ((metadata.theme || metadata.animationLevel) && _pi) {
        _pi.appendEntry("ask-user-theme", {
            theme: metadata.theme,
            animationLevel: metadata.animationLevel,
        });
    }
}

/** Strip XML-style `<thinking>` blocks and markdown reasoning blocks from text. */
function stripThinkingBlocks(text: string): string {
    return text
        .replace(/<thinking>[\s\S]*?<\/thinking>/g, "")
        .replace(/```\s*thinking\n[\s\S]*?```/g, "")
        .trim();
}

/** Execute ask_user with full enrichment + persistence, used by tool and commands alike. */
async function runAskUserWithTheme(
    rawParams: AskUserParams,
    signal: AbortSignal | undefined,
    ctx: ExtensionContext,
): Promise<ReturnType<typeof askUserHandler>> {
    const entries = ctx.sessionManager.getEntries();
    const params = enrichWithThemeSettings(rawParams, entries);
    let metadata: AskUserMetadata = {};

    // Strip reasoning chains from explicitly-passed context
    const cleanedParams: AskUserParams = params.context
        ? { ...params, context: stripThinkingBlocks(params.context) }
        : params;

    const result = await askUserHandler(cleanedParams, signal, ctx, (m) => {
        metadata = m;
    });
    saveThemeMetadata(metadata);
    return result;
}

/** Extract plain text from a Pi journal assistant entry. */
function extractTextFromAssistantEntry(entry: unknown): string {
    if (!entry || typeof entry !== "object") return "";
    const content = (
        (entry as Record<string, unknown>).message as
            | Record<string, unknown>
            | undefined
    )?.content;
    return extractTextFromContent(content);
}

/** Find the most recent assistant entry in the session journal. */
function findLastAssistantEntry(entries: unknown[]): unknown | undefined {
    return [...entries].reverse().find((e) => {
        if (!e || typeof e !== "object") return false;
        const msg = (e as Record<string, unknown>).message;
        if (!msg || typeof msg !== "object") return false;
        return (msg as Record<string, unknown>).role === "assistant";
    });
}

/* ── /ask: extract explicit questions only ── */

function splitSentences(text: string): string[] {
    const PLACEHOLDER = "\x00";

    let buffer = text.replace(/\b(e\.g\.|i\.e\.)\b/gi, (m) =>
        m.replace(/\./g, PLACEHOLDER),
    );

    buffer = buffer.replace(/\b([a-zA-Z]{1,4})\./g, (match, abbr) =>
        PROTECTED_ABBREVIATIONS.has(abbr.toLowerCase())
            ? match.replace(".", PLACEHOLDER)
            : match,
    );

    buffer = buffer.replace(/\d+\.\d+/g, (m) => m.replace(/\./g, PLACEHOLDER));
    buffer = buffer.replace(/https?:\/\/\S+/g, (m) =>
        m.replace(/\./g, PLACEHOLDER),
    );
    buffer = buffer.replace(/\b\w\.\w\./g, (m) =>
        m.replace(/\./g, PLACEHOLDER),
    );

    return buffer
        .split(/(?<=[.!?])\s+/)
        .map((s) => s.trim().replace(new RegExp(PLACEHOLDER, "g"), "."))
        .filter((s) => s.length > 0);
}

function hasQuotedQuestion(sentence: string): boolean {
    return /["'`].*\?.*["'`]/.test(sentence) && !sentence.endsWith("?");
}

function looksLikeTernary(sentence: string): boolean {
    return /\?\s*[:;]/.test(sentence) || /=\s*\S+\s*\?/.test(sentence);
}

/** Extract only explicit questions (sentences ending in ?).
 *  Implicit requests like "let me know" are ignored — the freeform textarea
 *  already handles open-ended input without creating phantom questionnaire rows. */
function extractQuestions(text: string): string[] {
    return splitSentences(text).filter((sentence) => {
        if (!sentence.endsWith("?")) return false;
        if (hasQuotedQuestion(sentence)) return false;
        if (looksLikeTernary(sentence)) return false;
        if (sentence.length < 3) return false;
        return true;
    });
}

function truncate(str: string, max: number): string {
    return str.length > max ? `${str.slice(0, max - 3)}...` : str;
}

function buildAskLastParams(
    questions: string[],
    fullText: string,
): AskUserParams {
    const cleanContext = stripThinkingBlocks(fullText);
    if (questions.length === 0) {
        return {
            question: "The assistant would like your input on the following:",
            context: cleanContext,
            allowFreeform: true,
        };
    }
    if (questions.length === 1) {
        return {
            question: questions[0],
            context: cleanContext,
            allowFreeform: true,
        };
    }
    return {
        question: "The assistant asked multiple questions",
        context: cleanContext,
        questions: questions.map((q) => ({
            title: truncate(q, 60),
            description: q,
        })),
        allowComment: true,
        allowSkip: true,
    };
}

/** Build a user-facing prefix for an auto-caught or manual /ask answer. */
function answerPrefix(questionCount: number): string {
    if (questionCount === 0) {
        return "Responding to your last message:";
    }
    const plural = questionCount > 1 ? "s" : "";
    return `Answering the question${plural} from your last message:`;
}

function buildDebugParams(mode: string): AskUserParams | null {
    switch (mode) {
        case "single-select":
            return {
                question: "Test: Single Select",
                context:
                    "Pick one option (with optional freeform and comment). This tests radio-style selection, recommended badges, search filtering, and keyboard navigation.",
                options: [
                    {
                        title: "Option A",
                        description: "Description for A",
                        recommended: true,
                    },
                    { title: "Option B", description: "Description for B" },
                    { title: "Option C", description: "Description for C" },
                ],
                allowFreeform: true,
                allowComment: true,
            };
        case "multi-select":
            return {
                question: "Test: Multi Select",
                context:
                    "Pick multiple options (with optional freeform and comment). This tests checkbox-style selection, select-all/none links, and submit-gating.",
                options: [
                    {
                        title: "Feature X",
                        description: "Enable feature X",
                        recommended: true,
                    },
                    { title: "Feature Y", description: "Enable feature Y" },
                    { title: "Feature Z", description: "Enable feature Z" },
                ],
                allowMultiple: true,
                allowFreeform: true,
                allowComment: true,
            };
        case "freeform":
            return {
                question: "Test: Freeform",
                context:
                    "Type any answer you like. This tests the textarea, character counter, and platform-aware keyboard shortcuts.",
                allowFreeform: true,
            };
        case "questionnaire":
            return {
                question: "Test: Questionnaire",
                context:
                    "Answer multiple structured questions. This tests the card layout, progress bar, required-field badges, and per-question character counters.",
                questions: [
                    {
                        title: "Database",
                        description: "Which database should we use?",
                        options: [
                            {
                                title: "PostgreSQL",
                                description: "Relational, proven",
                                recommended: true,
                            },
                            { title: "SQLite", description: "Zero-config" },
                        ],
                    },
                    {
                        title: "Architecture",
                        description: "Preferred style?",
                        options: [
                            {
                                title: "Monolith",
                                description: "Simple",
                                recommended: true,
                            },
                            { title: "Microservices", description: "Scalable" },
                        ],
                        allowMultiple: true,
                    },
                    {
                        title: "Notes",
                        description: "Any additional thoughts?",
                    },
                ],
                allowComment: true,
            };
        case "kitchen-sink":
            return {
                question: "Kitchen Sink: Every Feature",
                contextFormat: "html",
                context: `<div style="font-family: ui-sans-serif, system-ui, sans-serif; overflow-wrap: break-word;">
  <h2 style="color: hsl(var(--primary)); margin-bottom: 0.75rem; font-size: 1.25rem; font-weight: 600;">🧪 Debug Kitchen Sink</h2>
  <p style="color: hsl(var(--muted-foreground)); margin-bottom: 1rem; line-height: 1.5;">
    This dialog demonstrates every major feature — including the built-in <code style="background: hsl(var(--muted)); padding: 0.125rem 0.25rem; border-radius: 4px; font-size: 0.875em;">pi</code> charting helpers.
  </p>

  <div id="chart-bar" style="margin-bottom: 1rem;"></div>
  <div id="chart-pie" style="margin-bottom: 1rem;"></div>
  <div id="comparison-table" style="margin-bottom: 1rem;"></div>
  <div id="pros-cons" style="margin-bottom: 1rem;"></div>
  <div id="timeline" style="margin-bottom: 1rem;"></div>
  <div id="metrics" style="margin-bottom: 1rem;"></div>

  <script>
    pi.barChart('#chart-bar', [
      {label: 'Monolith', value: 95},
      {label: 'Microservices', value: 70},
      {label: 'Serverless', value: 55}
    ], {title: 'Deployment Velocity Score', highlightIndex: 0, showValues: true});

    pi.pieChart('#chart-pie', [
      {label: 'Auth', value: 30},
      {label: 'Cache', value: 25},
      {label: 'Rate Limit', value: 20},
      {label: 'Observability', value: 25}
    ], {title: 'Feature Effort Distribution', donut: true, showLegend: true});

    pi.table('#comparison-table',
      ['Feature', 'Monolith', 'Microservices', 'Serverless'],
      [
        ['Complexity', 'Low', 'High', 'Medium'],
        ['Scalability', 'Vertical', 'Horizontal', 'Auto'],
        ['Cost', 'Fixed', 'Variable', 'Pay-per-use'],
        ['Team Size', 'Small', 'Large', 'Any']
      ],
      {title: 'Architecture Comparison', highlightColumn: 1, striped: true, compact: true}
    );

    pi.prosCons('#pros-cons',
      ['Simple deployment', 'Single codebase', 'Easy debugging', 'Low infra cost'],
      ['Hard to scale', 'Tight coupling', 'Single point of failure', 'Slower CI/CD'],
      {title: 'Monolith Trade-offs'}
    );

    pi.timeline('#timeline', [
      {date: 'Week 1', title: 'Scoping', status: 'complete'},
      {date: 'Week 2', title: 'Design', status: 'complete'},
      {date: 'Week 3', title: 'Build MVP', status: 'current'},
      {date: 'Week 4', title: 'Launch', status: 'pending'}
    ], {title: 'Project Timeline'});

    pi.metrics('#metrics', [
      {label: 'Latency (p99)', value: '42ms', change: '-12%', trend: 'down'},
      {label: 'Throughput', value: '12.4k rps', change: '+8%', trend: 'up'},
      {label: 'Error Rate', value: '0.02%', change: '-0.01%', trend: 'down'},
      {label: 'Uptime', value: '99.97%', change: '+0.02%', trend: 'up'}
    ], {title: 'System Metrics', columns: 2});
  </script>

  <p style="color: hsl(var(--muted-foreground)); font-size: 0.875rem; line-height: 1.5; margin-top: 1rem;">
    Try keyboard shortcuts: <strong>1-9</strong> per question · <strong>0</strong> comments · <strong>Tab</strong> next · <strong>Esc</strong> cancel · <strong>⌘Enter</strong> submit · <strong>↑↓</strong> navigate · <strong>Space</strong> toggle · theme toggle (⚙️).
  </p>
</div>`,
                questions: [
                    {
                        title: "Architecture",
                        description: "Which architecture style should we use?",
                        options: [
                            {
                                title: "Monolith",
                                description: "Simple, single deployable",
                                recommended: true,
                            },
                            {
                                title: "Microservices",
                                description: "Scalable, complex",
                            },
                            {
                                title: "Serverless",
                                description: "Event-driven, pay-per-use",
                            },
                        ],
                    },
                    {
                        title: "Features",
                        description: "Select all features to implement:",
                        options: [
                            {
                                title: "Authentication",
                                description: "OAuth + JWT",
                            },
                            { title: "Caching", description: "Redis layer" },
                            {
                                title: "Rate Limiting",
                                description: "Token bucket",
                            },
                            {
                                title: "Observability",
                                description: "Metrics + logs",
                            },
                        ],
                        allowMultiple: true,
                    },
                    {
                        title: "Deployment Target",
                        description: "Where should we deploy?",
                        options: [
                            {
                                title: "Vercel",
                                description: "Edge, serverless-first",
                            },
                            {
                                title: "AWS",
                                description: "Full control, scalable",
                            },
                            {
                                title: "Self-hosted",
                                description: "Own the infrastructure",
                            },
                        ],
                    },
                    {
                        title: "Notes",
                        description:
                            "Any additional requirements or constraints?",
                    },
                ],
                allowComment: true,
                allowSkip: true,
            };
        default:
            return null;
    }
}

const askUserPrompt = loadAskUserPrompt();

const askUserTool = defineTool({
    name: "ask_user",
    label: "Ask User",
    description: askUserPrompt.description,
    promptSnippet: askUserPrompt.snippet,
    promptGuidelines: askUserPrompt.guidelines,
    parameters: Type.Object({
        question: Type.String({
            description:
                "A short, focused question (ideally one sentence). Put background detail in context.",
        }),
        context: Type.Optional(
            Type.String({
                description:
                    "Background, examples, or elaboration that helps the user understand the question. Shown in a side panel, so keep the question itself concise. Supports Mermaid diagrams (flowcharts, sequence diagrams, etc.) — wrap them in ```mermaid code blocks. Use contextFormat: 'html' for rich visualizations with the built-in pi helpers (pi.table, pi.barChart, pi.prosCons, pi.metrics, pi.pieChart, pi.timeline).",
            }),
        ),
        contextFormat: Type.Optional(
            StringEnum(["markdown", "html"], {
                description:
                    "Format of the context field. 'markdown' (default) renders as formatted text. 'html' renders in a sandboxed iframe with automatic light/dark theme consistency. Use HTML context for comparison tables, bar charts, pros/cons lists, metric cards, timelines, and interactive layouts that help the user understand trade-offs and decide faster.",
            }),
        ),
        options: Type.Optional(
            Type.Array(
                Type.Object(
                    {
                        title: Type.String({
                            description:
                                "Short title for this option (the option text itself)",
                        }),
                        description: Type.Optional(
                            Type.String({
                                description:
                                    "Longer description explaining this option",
                            }),
                        ),
                        recommended: Type.Optional(
                            Type.Boolean({
                                description:
                                    "Mark this option as most recommended. Shows a badge in the dialog.",
                            }),
                        ),
                    },
                    {
                        description:
                            "List of options for the user to choose from",
                    },
                ),
            ),
        ),
        questions: Type.Optional(
            Type.Array(
                Type.Object(
                    {
                        title: Type.String({ description: "Question title" }),
                        description: Type.Optional(
                            Type.String({
                                description: "Question description",
                            }),
                        ),
                        options: Type.Optional(
                            Type.Array(
                                Type.Object({
                                    title: Type.String({
                                        description: "Option title",
                                    }),
                                    description: Type.Optional(
                                        Type.String({
                                            description: "Option description",
                                        }),
                                    ),
                                    recommended: Type.Optional(
                                        Type.Boolean({
                                            description:
                                                "Mark this option as most recommended. Shows a badge in the dialog.",
                                        }),
                                    ),
                                }),
                                {
                                    description:
                                        "Options for this question (omit for freeform text)",
                                },
                            ),
                        ),
                        allowMultiple: Type.Optional(
                            Type.Boolean({
                                description:
                                    "Allow multiple selections for this question. Default: false",
                            }),
                        ),
                    },
                    {
                        description:
                            "For questionnaire mode: structured questions with optional multiple-choice options per question",
                    },
                ),
            ),
        ),
        allowMultiple: Type.Optional(
            Type.Boolean({
                description: "Allow selecting multiple options. Default: false",
            }),
        ),
        allowFreeform: Type.Optional(
            Type.Boolean({
                description: "Add a freeform text option. Default: true",
            }),
        ),
        allowComment: Type.Optional(
            Type.Boolean({
                description:
                    "Collect an optional comment after selecting one or more options. Default: false",
            }),
        ),
        displayMode: Type.Optional(
            StringEnum(["overlay", "inline"], {
                description:
                    "Legacy option; ignored by Glimpse (always opens a centered dialog)",
            }),
        ),
        allowSkip: Type.Optional(
            Type.Boolean({
                description:
                    "Allow submitting a questionnaire without answering all questions. Default: false",
            }),
        ),
        followCursor: Type.Optional(
            Type.Boolean({
                description:
                    "Make the dialog follow the terminal cursor. Default: false",
            }),
        ),
    }),

    async execute(_toolCallId, params, signal, _onUpdate, ctx) {
        return runAskUserWithTheme(params as AskUserParams, signal, ctx);
    },
});

export default function (pi: ExtensionAPI) {
    _pi = pi;
    pi.registerTool(askUserTool);

    const guidelineCount = askUserPrompt.guidelines.length;
    if (guidelineCount === 0) {
        // Warn only in development — this surfaces if prompt files are missing
        // but only once at startup, not on every turn
        console.warn(
            `[pi-ask-user-glimpse] WARNING: No prompt guidelines loaded — check that prompts/ask-user.md has a ## Guidelines section.`,
        );
    }

    /** Send a user answer back into the journal with consistent error handling. */
    async function deliverAnswer(
        prefix: string,
        answer: string,
        ctx: ExtensionContext,
    ) {
        try {
            await pi.sendUserMessage(`${prefix}\n\n${answer}`, {
                deliverAs: "steer",
            });
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            console.error(
                `[pi-ask-user-glimpse] sendUserMessage failed: ${msg}`,
            );
            ctx.ui?.notify(`Failed to send answer: ${msg}`, "error");
        }
    }

    // ── Inject mandate based on ask style ──
    pi.on("before_agent_start", async (event, ctx) => {
        const hasAskUser =
            event.systemPromptOptions.selectedTools?.includes("ask_user");
        if (!hasAskUser) {
            return;
        }

        // Don't force ask_user in headless environments — the tool can't render dialogs
        if (!ctx.hasUI) {
            return;
        }

        const styleMode = getStyleMode(ctx.sessionManager.getEntries());

        if (styleMode === "yolo") {
            const yoloMandate = loadYoloMandate();
            return { systemPrompt: event.systemPrompt + "\n" + yoloMandate };
        }
        // "plain" → no injection; silently return undefined
    });

    // ── Manual style toggle ──
    pi.registerCommand("ask-style", {
        description: "Cycle ask_user style: Plain Text → YOLO → Plain Text",
        handler: async (_args, ctx) => {
            const styleMode = getStyleMode(ctx.sessionManager.getEntries());

            let nextMode: StyleMode;
            let label: string;

            if (styleMode === "plain") {
                nextMode = "yolo";
                label = "YOLO — go with your recommendation";
            } else {
                nextMode = "plain";
                label = "Plain Text (no dialog injection)";
            }

            await pi.appendEntry("ask-user-style", { mode: nextMode });
            ctx.ui.notify(`ask_user style: ${label}`, "info");
        },
    });

    pi.registerCommand("ask", {
        description:
            "Extract questions from the last assistant message and ask them via ask_user",
        handler: async (_args, ctx) => {
            if (!ctx.hasUI) {
                console.warn(
                    "[pi-ask-user-glimpse] /ask requires interactive mode",
                );
                return;
            }

            const entries = ctx.sessionManager.getEntries();
            const lastAssistant = findLastAssistantEntry(entries);

            if (!lastAssistant) {
                ctx.ui.notify(
                    "No assistant messages found in this session",
                    "warning",
                );
                return;
            }

            const fullText = extractTextFromAssistantEntry(lastAssistant);
            if (!fullText.trim()) {
                ctx.ui.notify(
                    "Last assistant message has no text content",
                    "warning",
                );
                return;
            }

            const questions = extractQuestions(fullText);

            const result = await runAskUserWithTheme(
                buildAskLastParams(questions, fullText),
                undefined,
                ctx,
            );

            if (result.details.cancelled) {
                ctx.ui.notify("Cancelled — no answer sent", "info");
                return;
            }

            const textContent = result.content[0];
            const answer = textContent?.type === "text" ? textContent.text : "";
            if (!answer) return;

            await deliverAnswer(answerPrefix(questions.length), answer, ctx);
        },
    });

    pi.registerCommand("ask-debug", {
        description: "Open a debug prompt to test each ask_user dialog type",
        handler: async (_args, ctx) => {
            if (!ctx.hasUI) {
                console.warn(
                    "[pi-ask-user-glimpse] ask-debug requires interactive mode",
                );
                return;
            }

            const mode = await ctx.ui.select("Choose a prompt type to test:", [
                "single-select",
                "multi-select",
                "freeform",
                "questionnaire",
                "kitchen-sink",
            ]);
            if (!mode) return;

            const params = buildDebugParams(mode);
            if (!params) return;

            const result = await runAskUserWithTheme(params, undefined, ctx);
            const textContent = result.content[0];
            const text =
                textContent.type === "text" ? textContent.text : "No response";

            // Render debug result in the conversation thread without triggering AI processing
            _pi?.sendMessage(
                {
                    customType: "ask-debug-result",
                    content: [
                        { type: "text", text: `[debug] ${mode} → ${text}` },
                    ],
                    display: true,
                },
                { triggerTurn: false },
            );
        },
    });

    pi.registerCommand("ask-user-config", {
        description: "Configure ask_user prompt file paths",
        handler: async (_args, ctx) => {
            const { readAskUserSettings, writeAskUserSettings } = await import(
                "./shared/settings.js"
            );
            const { getPromptOverrideStatus } = await import(
                "./shared/prompt-loader.js"
            );
            const settings = readAskUserSettings();
            const status = getPromptOverrideStatus();

            const choice = await ctx.ui.select(
                "ask_user prompt file configuration:",
                [
                    "Set ask-user prompt file",
                    "Set yolo mandate file",
                    "Clear all overrides",
                    "View current config",
                    "Done",
                ],
            );
            if (!choice) return;

            const handleInput = async (
                label: string,
                key: "askUserPrompt" | "yoloMandatePrompt",
            ): Promise<void> => {
                const current = settings[key] || "";
                const newPath = await ctx.ui.input(label, current);
                if (newPath === null || newPath === undefined) return;
                const trimmed = newPath.trim();
                if (trimmed) {
                    writeAskUserSettings({ ...settings, [key]: trimmed });
                    ctx.ui.notify(`${key} set to ${trimmed}`, "info");
                } else if (current) {
                    writeAskUserSettings({ ...settings, [key]: undefined });
                    ctx.ui.notify(`${key} cleared`, "info");
                }
            };

            if (choice === "Set ask-user prompt file") {
                await handleInput("Path to ask-user.md", "askUserPrompt");
            } else if (choice === "Set yolo mandate file") {
                await handleInput("Path to yolo-mandate.md", "yoloMandatePrompt");
            } else if (choice === "Clear all overrides") {
                writeAskUserSettings({});
                ctx.ui.notify("All overrides cleared", "info");
            } else if (choice === "View current config") {
                const lines = [
                    "ask_user prompt configuration:",
                    `  askUserPrompt:     ${settings.askUserPrompt || "(default)"}`,
                    `  yoloMandatePrompt: ${settings.yoloMandatePrompt || "(default)"}`,
                    `  askUser:           ${status.askUser}`,
                    `  yoloMandate:       ${status.yoloMandate}`,
                ];
                ctx.ui.notify(lines.join("\n"), "info");
            }
        },
    });
}
