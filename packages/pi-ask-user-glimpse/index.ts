/**
 * pi-ask-user-glimpse — Pi extension that replaces ask_user with native WebView dialogs via glimpseui.
 */

import {
    isCustomEntry,
    type CustomJournalEntry,
} from "@alexleekt/pi-shared/types";

import type { AgentMessage } from "@earendil-works/pi-agent-core";
import { StringEnum, Type } from "@earendil-works/pi-ai";
import type {
    ExtensionAPI,
    ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import { defineTool } from "@earendil-works/pi-coding-agent";
import { PROTECTED_ABBREVIATIONS } from "./constants/abbreviations.js";
import type { AnimationLevel, ThemeMode } from "./shared/ask-user.js";
import {
    type AskUserMetadata,
    type AskUserParams,
    askUserHandler,
} from "./tool/ask-user.js";

/* ── Module-level reference to ExtensionAPI for tool execute closure ── */
let _pi: ExtensionAPI | undefined;

/* ── Style mode constants ── */

const ASK_USER_MANDATE = `
## Tool Usage Mandate — Auto-injected by pi-ask-user-glimpse

When you need to ask the user a question, you MUST use the \`ask_user\`
tool. Do NOT write questions as free-form assistant text. Each question
should be a separate \`ask_user\` tool call.

Rules:
- One question per \`ask_user\` call.
- Provide concise options when the question has discrete choices.
- List options from most recommended to least recommended.
- Set \`allowMultiple: true\` when more than one choice is valid.
- Set \`allowFreeform: true\` when the user might want to answer in their own words.
- Wait for the tool result before continuing to the next question.
`;

const YOLO_MANDATE = `
## Tool Usage Mandate — Auto-injected by pi-ask-user-glimpse (YOLO Mode)

You are in YOLO mode. Do NOT ask the user for input or confirmation.
Go with your best recommendation and proceed immediately.

Only use \`ask_user\` if the action would cause irreversible harm,
data loss, security compromise, or violate explicit hard constraints.

Rules:
- Do NOT use \`ask_user\` for routine decisions or clarifications.
- Make the call and keep moving.
- If you must use \`ask_user\`, list options from most recommended to least recommended.
`;

type StyleMode = "always" | "plain" | "yolo";

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
    if (mode === "always" || mode === "plain" || mode === "yolo") {
        return mode;
    }
    return data?.enabled === false ? "plain" : "always";
}

function getThemeSettings(entries: unknown[]): {
    theme?: ThemeMode;
    animationLevel?: AnimationLevel;
} {
    const data = findCustomData(entries, "ask-user-theme");
    const theme = typeof data?.theme === "string" ? data.theme : undefined;
    const animationLevel =
        typeof data?.animationLevel === "string"
            ? data.animationLevel
            : undefined;
    return {
        theme:
            theme === "light" || theme === "dark" || theme === "system"
                ? theme
                : undefined,
        animationLevel:
            animationLevel === "none" ||
            animationLevel === "minimal" ||
            animationLevel === "all"
                ? animationLevel
                : undefined,
    };
}

/* ── Auto-catch helpers ── */

function findLastAssistantMessage(
    messages: AgentMessage[],
): AgentMessage | undefined {
    return [...messages].reverse().find((m) => m.role === "assistant");
}

/** Track which assistant messages we've already auto-caught. */
function wasAutoCaught(entries: unknown[], messageText: string): boolean {
    return entries.some(
        (e) =>
            isCustomEntry(e) &&
            e.customType === "ask-user-auto-caught" &&
            (e.data as Record<string, unknown>)?.text === messageText,
    );
}

/** Extract text blocks from a content array (AgentMessage or journal entry). */
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

function extractTextFromAgentMessage(message: AgentMessage): string {
    if (message.role !== "assistant") return "";
    const content = message.content;
    if (!Array.isArray(content)) return "";
    return extractTextFromContent(content);
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

/** Execute ask_user with full enrichment + persistence, used by tool and commands alike. */
async function runAskUserWithTheme(
    rawParams: AskUserParams,
    signal: AbortSignal | undefined,
    ctx: ExtensionContext,
): Promise<ReturnType<typeof askUserHandler>> {
    const entries = ctx.sessionManager.getEntries();
    const params = enrichWithThemeSettings(rawParams, entries);
    let metadata: AskUserMetadata = {};

    // Capture the agent's preceding message as additional context
    const preamble = buildAgentPreamble(params, entries);
    const enrichedParams: AskUserParams = preamble
        ? {
              ...params,
              context: params.context
                  ? `${preamble}\n\n---\n\n${params.context}`
                  : preamble,
          }
        : params;

    const result = await askUserHandler(enrichedParams, signal, ctx, (m) => {
        metadata = m;
    });
    saveThemeMetadata(metadata);
    return result;
}

/** Extract plain text from a Pi journal assistant entry. */
function extractTextFromAssistantEntry(entry: unknown): string {
    if (!entry || typeof entry !== "object") return "";
    const msg = (entry as Record<string, unknown>).message;
    if (!msg || typeof msg !== "object") return "";
    return extractTextFromContent((msg as Record<string, unknown>).content);
}

/** Find the most recent assistant entry in the session journal. */
function findLastAssistantEntry(entries: unknown[]): unknown | undefined {
    return [...entries].reverse().find((e) => {
        if (!e || typeof e !== "object") return false;
        const entry = e as Record<string, unknown>;
        const msg = entry.message;
        if (!msg || typeof msg !== "object" || msg === null) return false;
        return (msg as Record<string, unknown>).role === "assistant";
    });
}

/**
 * Extract the agent's introductory text from the most recent assistant
 * message, excluding text that is already duplicated in the question or
 * context fields.
 */
function buildAgentPreamble(
    params: AskUserParams,
    entries: unknown[],
): string | undefined {
    const lastAssistant = findLastAssistantEntry(entries);
    if (!lastAssistant) return undefined;

    const text = extractTextFromAssistantEntry(lastAssistant).trim();
    if (!text) return undefined;

    const question = params.question.trim();

    // Skip if the assistant text is just the question itself
    if (text === question) return undefined;

    // If the text ends with the question, take only the prefix
    if (text.endsWith(question)) {
        const prefix = text.slice(0, text.length - question.length).trim();
        return prefix || undefined;
    }

    // Skip if the assistant text is already fully contained in the context
    if (params.context?.trim().includes(text)) return undefined;

    return text;
}

/* ── /ask: extract questions & implicit requests ── */

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

const IMPLICIT_REQUEST_PATTERNS = [
    /\b(let me know|let us know)\b/i,
    /\b(tell me|tell us)\b/i,
    /\b(share your|share any)\b/i,
    /\b(what do you think|what are your thoughts)\b/i,
    /\b(which\b.*\b(would you|do you|should we)\b)/i,
    /\b(should we|can you confirm|please confirm|could you confirm)\b/i,
    /\b(i need your (input|feedback|thoughts|opinion))\b/i,
    /\b(your (thoughts|opinion|preference|feedback))\b/i,
    /\b(please provide|could you provide|can you provide)\b/i,
    /\b(would you like|do you want|do you prefer)\b/i,
];

function hasQuotedQuestion(sentence: string): boolean {
    return /["'`].*\?.*["'`]/.test(sentence) && !sentence.endsWith("?");
}

function looksLikeTernary(sentence: string): boolean {
    return /\?\s*[:;]/.test(sentence) || /=\s*\S+\s*\?/.test(sentence);
}

function extractQuestions(text: string): string[] {
    const explicit: string[] = [];
    const implicit: string[] = [];

    for (const sentence of splitSentences(text)) {
        if (sentence.endsWith("?")) {
            if (hasQuotedQuestion(sentence)) continue;
            if (looksLikeTernary(sentence)) continue;
            if (sentence.length < 3) continue;
            explicit.push(sentence);
            continue;
        }

        if (IMPLICIT_REQUEST_PATTERNS.some((p) => p.test(sentence))) {
            implicit.push(sentence);
        }
    }

    return [...explicit, ...implicit];
}

function truncate(str: string, max: number): string {
    return str.length > max ? `${str.slice(0, max - 3)}...` : str;
}

function buildAskLastParams(
    questions: string[],
    fullText: string,
): AskUserParams {
    if (questions.length === 0) {
        return {
            question: "The assistant would like your input on the following:",
            context: fullText,
            allowFreeform: true,
        };
    }
    if (questions.length === 1) {
        return {
            question: questions[0],
            context: fullText,
            allowFreeform: true,
        };
    }
    return {
        question: "The assistant asked multiple questions",
        context: fullText,
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
                context: "Pick one option (with optional freeform and comment). This tests radio-style selection, recommended badges, search filtering, and keyboard navigation.",
                options: [
                    { title: "Option A", description: "Description for A", recommended: true },
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
                    { title: "Feature X", description: "Enable feature X", recommended: true },
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
                context: "Type any answer you like. This tests the textarea, character counter, and platform-aware keyboard shortcuts.",
                allowFreeform: true,
            };
        case "questionnaire":
            return {
                question: "Test: Questionnaire",
                context: "Answer multiple structured questions. This tests the card layout, progress bar, required-field badges, and per-question character counters.",
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
                            { title: "Monolith", description: "Simple", recommended: true },
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
    Try keyboard navigation (↑↓ to move, Enter to select, / to search), theme toggle (⚙️), and the comment field.
  </p>
</div>`,
                questions: [
                    {
                        title: "Architecture",
                        description: "Which architecture style should we use?",
                        options: [
                            { title: "Monolith", description: "Simple, single deployable", recommended: true },
                            { title: "Microservices", description: "Scalable, complex" },
                            { title: "Serverless", description: "Event-driven, pay-per-use" }
                        ]
                    },
                    {
                        title: "Features",
                        description: "Select all features to implement:",
                        options: [
                            { title: "Authentication", description: "OAuth + JWT" },
                            { title: "Caching", description: "Redis layer" },
                            { title: "Rate Limiting", description: "Token bucket" },
                            { title: "Observability", description: "Metrics + logs" }
                        ],
                        allowMultiple: true
                    },
                    {
                        title: "Deployment Target",
                        description: "Where should we deploy?",
                        options: [
                            { title: "Vercel", description: "Edge, serverless-first" },
                            { title: "AWS", description: "Full control, scalable" },
                            { title: "Self-hosted", description: "Own the infrastructure" }
                        ]
                    },
                    {
                        title: "Notes",
                        description: "Any additional requirements or constraints?"
                    }
                ],
                allowComment: true,
                allowSkip: true
            };
        default:
            return null;
    }
}

const TOOL_DESCRIPTION = [
    "Ask the user a question with optional multiple-choice answers.",
    "Use this to gather information interactively. Ask exactly one focused question per call.",
    "Before calling, gather context with tools (read/web/ref) and pass a short summary via the context field.",
    "The context panel supports Mermaid diagrams (flowcharts, sequence diagrams, etc.).",
    "For richer visualizations, use contextFormat: 'html' with the built-in pi charting helpers:",
    "  pi.table(['Feature','A','B'], [['Auth','OAuth','SAML']], {highlightColumn:1}) — comparison tables;",
    "  pi.barChart('#chart', [{label:'A',value:30},{label:'B',value:80}], {highlightIndex:1}) — bar charts;",
    "  pi.prosCons('#pc', ['Fast','Simple'], ['Expensive','Locked'], {}) — trade-offs;",
    "  pi.metrics('#m', [{label:'Uptime',value:'99.9%',change:'+0.1%',trend:'up'}]) — KPI cards;",
    "  pi.pieChart('#pie', [{label:'X',value:30},{label:'Y',value:70}], {donut:true}) — distributions;",
    "  pi.timeline('#t', [{date:'Q1',title:'Plan',status:'complete'},{date:'Q2',title:'Build',status:'current'}]) — roadmaps.",
    "All helpers auto-theme to light/dark mode.",
].join(" ");

const askUserTool = defineTool({
    name: "ask_user",
    label: "Ask User",
    description: TOOL_DESCRIPTION,
    promptSnippet:
        "Ask the user one focused question with optional multiple-choice answers to gather information interactively",
    promptGuidelines: [
        "Always use ask_user instead of guessing when user input would improve the answer.",
        "Keep the question field short and focused (ideally one sentence). Put background, examples, or elaboration in the context field.",
        "Include Mermaid diagrams in the context field when visualizing architecture, data flows, or decision trees would help the user understand the question.",
        "Use contextFormat: 'html' for rich visualizations (comparison tables, bar charts, pros/cons lists, metric cards, timelines, and layouts) that help the user understand trade-offs and make faster decisions. The iframe inherits the wrapper's CSS variables for automatic theme consistency.",
        "When comparing 3+ options, render a comparison table with pi.table(headers, rows, {highlightColumn: recommendedIndex}).",
        "When showing quantitative data or performance metrics, use pi.barChart() or pi.metrics() to visualize the numbers.",
        "When weighing trade-offs, use pi.prosCons() to show a side-by-side comparison.",
        "Pass a concise question and, when applicable, a list of options with short titles and optional longer descriptions.",
        "List options from most recommended to least recommended.",
        "Set allowMultiple: true when more than one choice is valid.",
        "Set allowFreeform: true (default) when the user might want to answer in their own words.",
    ],
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
                Type.Union([
                    Type.String({ description: "Short option label" }),
                    Type.Object({
                        title: Type.String({
                            description: "Short title for this option",
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
                    }),
                ]),
                { description: "List of options for the user to choose from" },
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

    // ── Inject mandate based on style mode ──
    pi.on("before_agent_start", async (event, ctx) => {
        const hasAskUser =
            event.systemPromptOptions.selectedTools?.includes("ask_user");
        if (!hasAskUser) return;

        // Don't force ask_user in headless environments — the tool can't render dialogs
        if (!ctx.hasUI) return;

        const styleMode = getStyleMode(ctx.sessionManager.getEntries());

        if (styleMode === "always") {
            return { systemPrompt: event.systemPrompt + ASK_USER_MANDATE };
        }
        if (styleMode === "yolo") {
            return { systemPrompt: event.systemPrompt + YOLO_MANDATE };
        }
        // "plain" → no injection
    });

    // ── Auto-catch: detect free-form questions and auto-trigger dialog ──
    pi.on("agent_end", async (event, ctx) => {
        if (!ctx.hasUI) return;

        const entries = ctx.sessionManager.getEntries();
        const styleMode = getStyleMode(entries);
        // Auto-catch only when the agent is expected to use dialogs
        if (styleMode !== "always") return;

        const lastAssistant = findLastAssistantMessage(event.messages);
        if (!lastAssistant) return;

        const text = extractTextFromAgentMessage(lastAssistant).trim();
        if (!text) return;

        // Skip if we already auto-caught this exact text
        if (wasAutoCaught(entries, text)) return;

        const questions = extractQuestions(text);
        if (questions.length === 0) return;

        // Don't auto-catch if the user has already started typing a response
        const editorText = ctx.ui.getEditorText().trim();
        if (editorText.length > 0) {
            ctx.ui.notify(
                "The assistant asked a question — use /ask to answer via dialog, or /ask-style plain to disable auto-catch",
                "info",
            );
            return;
        }

        const result = await runAskUserWithTheme(
            buildAskLastParams(questions, text),
            undefined,
            ctx,
        );

        // Mark as caught so we don't re-trigger on the same message
        await pi.appendEntry("ask-user-auto-caught", { text });

        if (result.details.cancelled) return;

        const textContent = result.content[0];
        const answer = textContent?.type === "text" ? textContent.text : "";
        if (!answer) return;

        await deliverAnswer(answerPrefix(questions.length), answer, ctx);
    });

    // ── Manual style toggle for ask_user behavior ──
    pi.registerCommand("ask-style", {
        description:
            "Cycle ask_user style: Always Dialog → Plain Text → YOLO → Always Dialog",
        handler: async (_args, ctx) => {
            const styleMode = getStyleMode(ctx.sessionManager.getEntries());

            let nextMode: StyleMode;
            let label: string;

            if (styleMode === "always") {
                nextMode = "plain";
                label = "Plain Text (no dialog injection)";
            } else if (styleMode === "plain") {
                nextMode = "yolo";
                label = "YOLO — go with your recommendation";
            } else {
                nextMode = "always";
                label = "Always Dialog (default)";
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
            ctx.ui.notify(`Result: ${text}`, "info");
        },
    });
}
