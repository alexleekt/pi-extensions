/**
 * DEPRECATED — This logic is now built into the main extension (index.ts).
 *
 * The main extension supports YOLO style via a `/ask-style` toggle.
 * You do not need to copy this file anywhere if you installed
 * pi-ask-user-glimpse via `pi install`.
 *
 * Kept as a reference implementation of a single-skill `before_agent_start`
 * hook using `systemPromptOptions.skills` detection.
 */

import type {
    BuildSystemPromptOptions,
    ExtensionAPI,
} from "@earendil-works/pi-coding-agent";

const SKILL_NAME = "grill-with-docs";

/**
 * Instruction appended to the system prompt whenever grill-with-docs is active.
 * This overrides the skill's default behavior of writing questions as text.
 */
const ASK_USER_MANDATE = `
## Tool Usage Mandate — Auto-injected by grill-with-docs-middleware

You are in a grilling session. When you need to ask the user a question,
you MUST use the \`ask_user\` tool. Do NOT write questions as free-form
assistant text. Each question should be a separate \`ask_user\` tool call.

Rules:
- One question per \`ask_user\` call.
- Provide concise options when the question has discrete choices.
- Set \`allowMultiple: true\` when more than one choice is valid.
- Set \`allowFreeform: true\` when the user might want to answer in their own words.
- Wait for the tool result before continuing to the next question.
`;

function hasSkill(options: BuildSystemPromptOptions, name: string): boolean {
    return options.skills?.some((s) => s.name === name) ?? false;
}

export default function grillWithDocsMiddleware(pi: ExtensionAPI) {
    pi.on("before_agent_start", async (event) => {
        if (!hasSkill(event.systemPromptOptions, SKILL_NAME)) {
            // Skill not active — don't interfere with normal behavior
            return;
        }

        // Verify ask_user tool is available so we don't break the session
        const hasAskUser =
            event.systemPromptOptions.selectedTools?.includes("ask_user");
        if (!hasAskUser) {
            console.warn(
                "[grill-with-docs-middleware] grill-with-docs skill is active but ask_user tool is not available. " +
                    "Install pi-ask-user-glimpse or ensure ask_user is registered.",
            );
            return;
        }

        return {
            systemPrompt: event.systemPrompt + ASK_USER_MANDATE,
        };
    });
}
