// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Alex Lee

import { beforeEach, describe, expect, test } from "bun:test";
import { Container } from "@earendil-works/pi-tui";
import { clearState, setState } from "../state/store.js";
import { registerHeadingTool } from "./heading-tool.js";

function makeMockCtx(leafId: string | undefined) {
    return {
        sessionManager: {
            getSessionId: () => leafId,
            getLeafId: () => leafId,
            getBranch: () => [],
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
    fg: (_style: string, text: string) => text,
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

    test("execute 'get' returns only the goal", async () => {
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
        expect(result.content[0].text).toBe("Fix compose");
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

    test("renderCall returns an empty Container", () => {
        const pi = makeMockPi();
        registerHeadingTool(pi as any);
        const tool = pi.tools[0];
        const component = tool.renderCall({ action: "get" }, theme, undefined);
        expect(component).toBeInstanceOf(Container);
    });

    test("renderResult returns an empty Container", () => {
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
        expect(result).toBeInstanceOf(Container);
    });
});
