// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Alex Lee

import { beforeEach, describe, expect, mock, test } from "bun:test";
import { Text } from "@earendil-works/pi-tui";
import { registerHeadingTool } from "./heading-tool.js";
import { setState, clearState } from "../state/store.js";

mock.module("./skill-loader.js", () => ({
    getHeadingSkillDocument: () => "# Session Heading\n\nSkill doc from file.",
}));

function makeMockCtx(leafId: string | undefined) {
    return {
        sessionManager: {
            getLeafId: () => leafId,
        },
    };
}

function makeMockPi() {
    const tools: any[] = [];
    return {
        tools,
        registerTool: (tool: any) => {
            tools.push(tool);
        },
    };
}

const theme = {
    fg: (style: string, text: string) => text,
    bold: (text: string) => text,
};

describe("heading tool", () => {
    beforeEach(() => {
        clearState();
    });

    test("registers with correct metadata", () => {
        const pi = makeMockPi();
        registerHeadingTool(pi as any);
        expect(pi.tools.length).toBe(1);
        const tool = pi.tools[0];
        expect(tool.name).toBe("heading");
        expect(tool.label).toBe("Heading");
        expect(tool.promptGuidelines.length).toBeGreaterThan(0);
    });

    test("execute 'get' returns heading when state exists", async () => {
        setState("leaf-with-state", {
            topic: "Docker",
            goal: "Fix compose",
            achievement: "Fixed it",
        });
        const pi = makeMockPi();
        registerHeadingTool(pi as any);
        const tool = pi.tools[0];
        const result = await tool.execute(
            "id",
            { action: "get" },
            undefined,
            undefined,
            makeMockCtx("leaf-with-state"),
        );
        const text = result.content[0].text;
        expect(text).toContain("Topic: Docker");
        expect(text).toContain("Goal: Fix compose");
        expect(text).toContain("Achievement: Fixed it");
    });

    test("execute 'get' returns no-heading message when state is missing", async () => {
        const pi = makeMockPi();
        registerHeadingTool(pi as any);
        const tool = pi.tools[0];
        const result = await tool.execute(
            "id",
            { action: "get" },
            undefined,
            undefined,
            makeMockCtx("leaf-empty"),
        );
        expect(result.content[0].text).toContain("No heading set");
    });

    test("execute 'skill' returns skill document", async () => {
        const pi = makeMockPi();
        registerHeadingTool(pi as any);
        const tool = pi.tools[0];
        const result = await tool.execute(
            "id",
            { action: "skill" },
            undefined,
            undefined,
            makeMockCtx("leaf-with-state"),
        );
        expect(result.content[0].text).toContain("Session Heading");
    });

    test("execute returns unknown action for invalid action", async () => {
        const pi = makeMockPi();
        registerHeadingTool(pi as any);
        const tool = pi.tools[0];
        const result = await tool.execute(
            "id",
            { action: "invalid" },
            undefined,
            undefined,
            makeMockCtx("leaf-with-state"),
        );
        expect(result.content[0].text).toContain("Unknown action");
    });

    test("renderCall returns a Text component", () => {
        const pi = makeMockPi();
        registerHeadingTool(pi as any);
        const tool = pi.tools[0];
        const component = tool.renderCall({ action: "get" }, theme, undefined);
        expect(component).toBeInstanceOf(Text);
    });

    test("renderResult returns a Text component", () => {
        const pi = makeMockPi();
        registerHeadingTool(pi as any);
        const tool = pi.tools[0];
        const result = tool.renderResult(
            {
                content: [{ type: "text", text: "Test result" }],
                details: {},
            },
            { expanded: false, isPartial: false },
            theme,
            undefined,
        );
        expect(result).toBeInstanceOf(Text);
    });
});
