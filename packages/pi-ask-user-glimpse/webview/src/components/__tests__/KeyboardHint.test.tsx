import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import KeyboardHint from "../KeyboardHint";

describe("KeyboardHint", () => {
    it("renders key badges and labels", () => {
        render(
            <KeyboardHint
                items={[
                    { keys: ["Esc"], label: "cancel" },
                    { keys: ["1", "…", "9"], label: "select" },
                ]}
            />,
        );

        expect(screen.getByText("Esc")).toBeInTheDocument();
        expect(screen.getByText("cancel")).toBeInTheDocument();
        expect(screen.getByText("1")).toBeInTheDocument();
        expect(screen.getByText("…")).toBeInTheDocument();
        expect(screen.getByText("9")).toBeInTheDocument();
        expect(screen.getByText("select")).toBeInTheDocument();
    });

    it("renders empty with no items", () => {
        const { container } = render(<KeyboardHint items={[]} />);
        expect(container.firstChild).toBeEmptyDOMElement();
    });

    it("wraps multiple hint groups", () => {
        const { container } = render(
            <KeyboardHint
                items={[
                    { keys: ["A"], label: "first" },
                    { keys: ["B"], label: "second" },
                ]}
            />,
        );

        const spans = container.querySelectorAll("span.inline-flex");
        expect(spans.length).toBe(2);
    });
});
