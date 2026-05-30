// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Alex Lee

import type {
    AgentToolResult,
    ExtensionAPI,
    ExtensionContext,
    Theme,
} from "@earendil-works/pi-coding-agent";
import { StringEnum } from "@earendil-works/pi-ai";
import { Text } from "@earendil-works/pi-tui";
import { Type } from "typebox";
import { getState } from "../state/store.js";
import { getHeadingSkillDocument } from "./skill-loader.js";

const HEADING_PROMPT_GATE =
    "Before proceeding, check the current session heading. If the user's message shifts topic, acknowledge the shift and update the heading.";

const HEADING_PROMPT_GUIDELINES = [
    "The session heading reflects the current goal. Refer to it when planning your next actions.",
    "If the user's message introduces a new topic unrelated to the current heading, acknowledge the shift.",
    "Use the heading tool with action: 'get' to retrieve the current heading.",
    "Use the heading tool with action: 'skill' to retrieve the full heading skill documentation.",
];

type HeadingAction = "get" | "skill";

export function registerHeadingTool(pi: ExtensionAPI): void {
    pi.registerTool({
        name: "heading",
        label: "Heading",
        description:
            "Get the current session heading or retrieve the heading skill documentation. " +
            "Use this to stay aware of the session goal and to self-educate on heading conventions.",
        promptSnippet:
            "Get the current session heading or heading documentation. " +
            "Use this when you need to check the session goal or understand heading conventions.",
        promptGuidelines: [HEADING_PROMPT_GATE, ...HEADING_PROMPT_GUIDELINES],
        parameters: Type.Object({
            action: StringEnum(["get", "skill"], {
                description: "The heading action to perform",
            }),
        }),
        execute: async (_toolCallId, params, _signal, _onUpdate, ctx) =>
            headingToolExecute(params as { action: HeadingAction }, ctx),
        renderCall: (args: { action: string }, theme: Theme) => {
            return new Text(
                theme.fg("toolTitle", theme.bold("heading ")) +
                    theme.fg("accent", args.action),
                0,
                0,
            );
        },
        renderResult: (result) => {
            const text = Array.isArray(result.content)
                ? result.content.find((c) => c?.type === "text")?.text ?? ""
                : "";
            return new Text(text, 0, 0);
        },
    });
}

async function headingToolExecute(
    params: { action: HeadingAction },
    ctx: ExtensionContext,
): Promise<AgentToolResult<unknown>> {
    if (params.action === "skill") {
        return {
            content: [{ type: "text", text: getHeadingSkillDocument() }],
            details: {},
        };
    }

    if (params.action !== "get") {
        return {
            content: [
                {
                    type: "text",
                    text: `Unknown action: ${params.action}. Use 'get' or 'skill'.`,
                },
            ],
            details: {},
        };
    }

    const leafId = ctx.sessionManager.getLeafId();
    const state = leafId ? getState(leafId) : undefined;

    if (!state) {
        return {
            content: [
                {
                    type: "text",
                    text: "No heading set. The heading will be generated after the first user message.",
                },
            ],
            details: {},
        };
    }

    const lines = [`Topic: ${state.topic}`, `Goal: ${state.goal}`];
    if (state.achievement) {
        lines.push(`Achievement: ${state.achievement}`);
    }

    return {
        content: [{ type: "text", text: lines.join("\n") }],
        details: {},
    };
}
