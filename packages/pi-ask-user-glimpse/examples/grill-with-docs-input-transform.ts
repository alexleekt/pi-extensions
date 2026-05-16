/**
 * Grill-with-docs → ask_user middleware (input-transform variant)
 *
 * Alternative approach: intercepts user input that references grill-with-docs
 * and appends an instruction that forces ask_user usage.
 *
 * Pros: works even if the skill name doesn't appear in systemPromptOptions.skills
 * Cons: fragile — relies on detecting skill invocation in raw user text
 *
 * Install: copy to ~/.pi/agent/extensions/grill-with-docs-input-transform.ts
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const ASK_USER_APPENDIX = `

IMPORTANT: During this grilling session, you MUST use the \`ask_user\` tool for every question you ask me. Never write questions as free-form text. Each question should be a separate \`ask_user\` tool call with appropriate options.
`;

const GRILL_PATTERNS = [
    /^\s*\/grill-with-docs\b/,
    /^\s*\/skill:\s*grill-with-docs\b/,
    /grill.with.docs/i,
];

export default function grillWithDocsInputTransform(pi: ExtensionAPI) {
    pi.on("input", async (event) => {
        if (event.source !== "interactive") {
            return { action: "continue" };
        }

        const isGrillSession = GRILL_PATTERNS.some((p) => p.test(event.text));
        if (!isGrillSession) {
            return { action: "continue" };
        }

        return {
            action: "transform",
            text: event.text + ASK_USER_APPENDIX,
        };
    });
}
