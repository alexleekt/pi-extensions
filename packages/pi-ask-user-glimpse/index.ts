/**
 * pi-ask-user-glimpse — Pi extension that replaces ask_user with native WebView dialogs via glimpseui.
 */

import {
    isCustomEntry as _isCustomEntry,
    type CustomJournalEntry,
} from "@alexleekt/pi-shared/types";

/* ── Defensive: isCustomEntry may resolve to undefined in some jiti cache states ── */
const isCustomEntry: typeof _isCustomEntry =
    typeof _isCustomEntry === "function"
        ? _isCustomEntry
        : (e: unknown): e is CustomJournalEntry => {
              if (!e || typeof e !== "object") return false;
              const entry = e as Record<string, unknown>;
              return (
                  entry.type === "custom" &&
                  typeof entry.customType === "string" &&
                  typeof entry.data === "object" &&
                  entry.data !== null
              );
          };

import type { AgentMessage } from "@earendil-works/pi-agent-core";
import { StringEnum, Type } from "@earendil-works/pi-ai";
import type {
    ExtensionAPI,
    ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import { defineTool } from "@earendil-works/pi-coding-agent";
import { PROTECTED_ABBREVIATIONS } from "./constants/abbreviations.js";
import type { AnimationLevel, ThemeMode } from "./shared/ask-user.js";
import { type AskUserParams, askUserHandler } from "./tool/ask-user.js";

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

function getStyleMode(entries: unknown[]): StyleMode {
    const entry = entries.find(
        (e): e is CustomJournalEntry =>
            isCustomEntry(e) && e.customType === "ask-user-style",
    );
    const data = entry?.data as Record<string, unknown> | undefined;

    // Prefer new `mode` field
    const mode = data?.mode;
    if (mode === "always" || mode === "plain" || mode === "yolo") {
        return mode;
    }

    // Fall back to legacy `enabled` field for backward compatibility
    const enabled = data?.enabled;
    if (enabled === false) return "plain";
    return "always"; // true, null, or missing → default
}

function getThemeSettings(entries: unknown[]): {
    theme?: ThemeMode;
    animationLevel?: AnimationLevel;
} {
    const entry = entries.find(
        (e): e is CustomJournalEntry =>
            isCustomEntry(e) && e.customType === "ask-user-theme",
    );
    const data = entry?.data as Record<string, unknown> | undefined;
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

function isTextContent(c: unknown): c is { type: "text"; text: string } {
    return (
        typeof c === "object" &&
        c !== null &&
        (c as Record<string, unknown>).type === "text" &&
        typeof (c as Record<string, unknown>).text === "string"
    );
}

function extractTextFromAgentMessage(message: AgentMessage): string {
    if (message.role !== "assistant") return "";
    const content = message.content;
    if (!Array.isArray(content)) return "";
    return content
        .filter(isTextContent)
        .map((c) => c.text)
        .join("\n");
}

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
function saveThemeMetadata(
    metadata: import("./tool/ask-user.js").AskUserMetadata,
) {
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
    let metadata: import("./tool/ask-user.js").AskUserMetadata = {};

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
    const e = entry as Record<string, unknown>;
    const message = e.message;
    if (!message || typeof message !== "object") return "";
    const msg = message as Record<string, unknown>;

    const content = msg.content;
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

/** Find the most recent assistant entry in the session journal. */
function findLastAssistantEntry(entries: unknown[]): unknown | undefined {
    return [...entries].reverse().find((e) => {
        if (!e || typeof e !== "object") return false;
        const entry = e as unknown as Record<string, unknown>;
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
                context: "Pick one option (with optional freeform and comment)",
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
                    "Pick multiple options (with optional freeform and comment)",
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
                context: "Type any answer you like",
                allowFreeform: true,
            };
        case "questionnaire":
            return {
                question: "Test: Questionnaire",
                context: "Answer multiple structured questions",
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
        case "long-question":
            return {
                question:
                    "This is a very long question that exceeds one hundred and twenty characters so it should trigger the auto-split behavior. The first sentence becomes the dialog title, and the rest flows to the context panel.",
                options: [
                    {
                        title: "Split worked",
                        description: "Title is short, context has the rest",
                    },
                    {
                        title: "Not split",
                        description: "Everything is still in the title",
                    },
                ],
                allowComment: true,
            };
        case "mermaid":
            return {
                question: "Test: Mermaid Diagrams",
                context: `This prompt includes Mermaid diagrams to test rendering in the left context panel.

\`\`\`mermaid
graph TD
    A[User asks question] --> B{Has context?}
    B -->|Yes| C[Show left panel]
    B -->|No| D[Single panel]
    C --> E[Render markdown + diagrams]
    D --> E
\`\`\`

The diagram above should render as an SVG. Below is a sequence diagram:

\`\`\`mermaid
sequenceDiagram
    participant Agent
    participant User
    Agent->>User: Ask question
    User->>Agent: Submit answer
\`\`\`
`,
                options: [
                    {
                        title: "Looks good",
                        description: "Diagrams render correctly",
                    },
                    { title: "Broken", description: "Something is wrong" },
                ],
                allowComment: true,
            };
        case "html-context":
            return {
                question: "Test: HTML Context",
                context: `<div style="text-align:center; padding: 1rem;">
    <h2 style="color: hsl(var(--primary)); margin-bottom: 0.5rem;">Sample Visualization</h2>
    <div style="display: flex; gap: 0.5rem; justify-content: center; margin: 1rem 0;">
        <div style="width: 40px; height: 80px; background: hsl(var(--primary)); border-radius: 4px;"></div>
        <div style="width: 40px; height: 120px; background: hsl(var(--secondary)); border-radius: 4px;"></div>
        <div style="width: 40px; height: 60px; background: hsl(var(--muted)); border-radius: 4px;"></div>
        <div style="width: 40px; height: 100px; background: hsl(var(--accent)); border-radius: 4px;"></div>
    </div>
    <p style="color: hsl(var(--muted-foreground)); font-size: 0.875rem;">This bar chart uses the wrapper's CSS variables for theme consistency.</p>
    <script>
        document.querySelectorAll('div > div').forEach((bar, i) => {
            const target = bar.style.height;
            bar.style.height = '0px';
            bar.style.transition = 'height 0.6s ease ' + (i * 0.1) + 's';
            setTimeout(() => bar.style.height = target, 50);
        });
    </script>
</div>`,
                contextFormat: "html",
                options: [
                    {
                        title: "Looks good",
                        description: "HTML renders with theme colors",
                    },
                    { title: "Broken", description: "Something is wrong" },
                ],
                allowComment: true,
            };
        case "recommended-badges":
            return {
                question: "Test: Recommendation Badges",
                context: "Each option with `recommended: true` should show a **Recommended** badge next to its title. This tests both single-select rendering and the badge styling.",
                options: [
                    { title: "Use **React**", description: "Popular, ecosystem-rich. `recommended` is set.", recommended: true },
                    { title: "Use *Vue*", description: "Approachable, progressive. No badge." },
                    { title: "Use `Svelte`", description: "Compiler-based, minimal. No badge." },
                ],
                allowComment: true,
            };
        case "tic-tac-toe":
            return {
                question: "Test: Tic-Tac-Toe Game",
                context: `<div style="text-align:center; font-family: ui-sans-serif, system-ui, sans-serif;">
    <h2 style="color: hsl(var(--primary)); margin-bottom: 0.5rem;">Tic-Tac-Toe</h2>
    <p id="status" style="color: hsl(var(--muted-foreground)); margin-bottom: 1rem; min-height: 1.5rem;">X's turn</p>
    <div id="board" style="display: grid; grid-template-columns: repeat(3, 80px); gap: 4px; justify-content: center; margin-bottom: 1rem;">
        ${Array.from({ length: 9 }, (_, i) => `<div data-idx="${i}" style="width:80px; height:80px; display:flex; align-items:center; justify-content:center; font-size:2rem; font-weight:bold; cursor:pointer; background: hsl(var(--muted) / 0.3); border-radius: 8px; color: hsl(var(--foreground));"></div>`).join('')}
    </div>
    <button id="reset" style="padding: 8px 16px; border: 1px solid hsl(var(--border)); border-radius: 6px; background: hsl(var(--card)); color: hsl(var(--foreground)); cursor: pointer; font-size: 0.875rem;">Reset Game</button>
    <script>
        (function() {
            const cells = document.querySelectorAll('#board > div');
            const status = document.getElementById('status');
            const resetBtn = document.getElementById('reset');
            let board = Array(9).fill('');
            let current = 'X';
            let gameOver = false;
            const wins = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];

            function checkWin() {
                for (const [a,b,c] of wins) {
                    if (board[a] && board[a] === board[b] && board[a] === board[c]) return board[a];
                }
                if (board.every(Boolean)) return 'Draw';
                return null;
            }

            function render() {
                cells.forEach((cell, i) => {
                    cell.textContent = board[i];
                    cell.style.color = board[i] === 'X' ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))';
                });
                const winner = checkWin();
                if (winner) {
                    gameOver = true;
                    status.textContent = winner === 'Draw' ? "It's a draw!" : winner + ' wins!';
                    status.style.color = 'hsl(var(--primary))';
                } else {
                    status.textContent = current + "'s turn";
                    status.style.color = 'hsl(var(--muted-foreground))';
                }
            }

            cells.forEach(cell => {
                cell.addEventListener('click', () => {
                    const i = +cell.dataset.idx;
                    if (board[i] || gameOver) return;
                    board[i] = current;
                    current = current === 'X' ? 'O' : 'X';
                    render();
                });
            });

            resetBtn.addEventListener('click', () => {
                board = Array(9).fill('');
                current = 'X';
                gameOver = false;
                render();
            });
        })();
    </script>
</div>`,
                contextFormat: "html",
                options: [
                    { title: "Game works", description: "Interactive tic-tac-toe renders and plays" },
                    { title: "Broken", description: "Something is wrong" },
                ],
                allowFreeform: true,
                allowComment: true,
            };
        default:
            return null;
    }
}

const askUserTool = defineTool({
    name: "ask_user",
    label: "Ask User",
    description:
        "Ask the user a question with optional multiple-choice answers. Use this to gather information interactively. Ask exactly one focused question per call. Before calling, gather context with tools (read/web/ref) and pass a short summary via the context field. The context panel supports Mermaid diagrams (flowcharts, sequence diagrams, etc.) — include them when visualizing architecture, flows, or relationships would aid understanding.",
    promptSnippet:
        "Ask the user one focused question with optional multiple-choice answers to gather information interactively",
    promptGuidelines: [
        "Always use ask_user instead of guessing when user input would improve the answer.",
        "Keep the question field short and focused (ideally one sentence). Put background, examples, or elaboration in the context field.",
        "Include Mermaid diagrams in the context field when visualizing architecture, data flows, or decision trees would help the user understand the question.",
        "Use contextFormat: 'html' for throwaway visualizations (charts, tables, layouts) that text cannot communicate. The iframe inherits the wrapper's CSS variables for theme consistency.",
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
                    "Background, examples, or elaboration that helps the user understand the question. Shown in a side panel, so keep the question itself concise. Supports Mermaid diagrams (flowcharts, sequence diagrams, etc.) — wrap them in ```mermaid code blocks. Use contextFormat: 'html' for rich visualizations.",
            }),
        ),
        contextFormat: Type.Optional(
            StringEnum(["markdown", "html"], {
                description:
                    "Format of the context field. 'markdown' (default) renders as formatted text. 'html' renders in a sandboxed iframe — useful for throwaway charts, tables, or interactive visualizations. The iframe inherits the wrapper's CSS variables for theme consistency.",
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

    // ── Inject mandate based on style mode ──
    pi.on("before_agent_start", async (event, ctx) => {
        const hasAskUser =
            event.systemPromptOptions.selectedTools?.includes("ask_user");
        if (!hasAskUser) return;

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

        pi.sendUserMessage(
            `${answerPrefix(questions.length)}\n\n${answer}`,
            { deliverAs: "followUp" },
        );
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

            pi.sendUserMessage(
                `${answerPrefix(questions.length)}\n\n${answer}`,
                { deliverAs: "steer" },
            );
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
                "long-question",
                "mermaid",
                "html-context",
                "tic-tac-toe",
                "recommended-badges",
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
