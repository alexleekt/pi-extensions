import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import ContextPanel from "../ContextPanel";

vi.mock("../../util/settings.js", () => ({
    useSettings: () => ({ resolvedTheme: "light" as const }),
}));

vi.mock("../../util/pi-charts.js", () => ({
    PI_CHARTS_LIBRARY: "",
}));

vi.mock("../SettingsButton", () => ({
    default: () => <div data-testid="settings-button" />,
}));

vi.mock("mermaid", () => ({
    default: {
        initialize: vi.fn(),
        run: vi.fn(() => Promise.resolve()),
    },
}));

describe("ContextPanel MermaidRenderer", () => {
    it("renders non-mermaid code block with language class", () => {
        const { container } = render(
            <ContextPanel context="```typescript\nconst x = 1;\n```" contextFormat="markdown" />,
        );
        const markdownDiv = container.querySelector(".markdown-body");
        expect(markdownDiv).toBeInTheDocument();
        expect(markdownDiv?.innerHTML).toContain("typescript");
    });
});
