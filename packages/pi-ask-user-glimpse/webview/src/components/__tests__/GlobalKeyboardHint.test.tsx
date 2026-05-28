import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import GlobalKeyboardHint from "../GlobalKeyboardHint";

describe("GlobalKeyboardHint", () => {
    it("renders single-select hints", () => {
        render(
            <GlobalKeyboardHint
                payload={{
                    type: "single-select",
                    question: "Test?",
                    options: [],
                    allowFreeform: true,
                    allowMultiple: false,
                    allowComment: false,
                }}
            />,
        );
        expect(screen.getByText("cancel")).toBeInTheDocument();
        expect(screen.getByText("not listed")).toBeInTheDocument();
    });

    it("renders multi-select hints", () => {
        render(
            <GlobalKeyboardHint
                payload={{
                    type: "multi-select",
                    question: "Test?",
                    options: [],
                    allowFreeform: true,
                    allowMultiple: true,
                    allowComment: false,
                }}
            />,
        );
        expect(screen.getAllByText("toggle").length).toBeGreaterThanOrEqual(1);
        expect(screen.getByText("not listed")).toBeInTheDocument();
    });

    it("renders questionnaire hints", () => {
        render(
            <GlobalKeyboardHint
                payload={{
                    type: "questionnaire",
                    question: "Test?",
                    options: [],
                    allowFreeform: false,
                    allowMultiple: false,
                    allowComment: false,
                }}
            />,
        );
        expect(screen.getByText("per question")).toBeInTheDocument();
    });

    it("renders freeform hints", () => {
        render(
            <GlobalKeyboardHint
                payload={{
                    type: "freeform",
                    question: "Test?",
                    options: [],
                    allowFreeform: true,
                    allowMultiple: false,
                    allowComment: false,
                }}
            />,
        );
        expect(screen.getByText("cancel")).toBeInTheDocument();
        expect(screen.getByText("submit")).toBeInTheDocument();
    });

    it("returns null for unknown type", () => {
        const { container } = render(
            <GlobalKeyboardHint
                payload={{
                    type: "unknown" as "single-select",
                    question: "Test?",
                    options: [],
                    allowFreeform: false,
                    allowMultiple: false,
                    allowComment: false,
                }}
            />,
        );
        expect(container.firstChild).toBeNull();
    });
});
