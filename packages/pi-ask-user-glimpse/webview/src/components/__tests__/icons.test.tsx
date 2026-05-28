import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { RadioIcon, CheckIcon, HelpIcon, CommentIcon, isSelectAllOption } from "../icons";

describe("icons", () => {
    it("RadioIcon renders unchecked", () => {
        const { container } = render(<RadioIcon checked={false} />);
        expect(container.querySelector("svg")).toBeInTheDocument();
    });

    it("RadioIcon renders checked", () => {
        const { container } = render(<RadioIcon checked={true} />);
        expect(container.querySelector("svg")).toBeInTheDocument();
    });

    it("CheckIcon renders unchecked", () => {
        const { container } = render(<CheckIcon checked={false} />);
        expect(container.querySelector("svg")).toBeInTheDocument();
    });

    it("CheckIcon renders checked", () => {
        const { container } = render(<CheckIcon checked={true} />);
        expect(container.querySelector("svg")).toBeInTheDocument();
    });

    it("HelpIcon renders", () => {
        const { container } = render(<HelpIcon />);
        expect(container.querySelector("svg")).toBeInTheDocument();
    });

    it("CommentIcon renders", () => {
        const { container } = render(<CommentIcon />);
        expect(container.querySelector("svg")).toBeInTheDocument();
    });

    it("isSelectAllOption matches select-all patterns", () => {
        expect(isSelectAllOption("All of the above")).toBe(true);
        expect(isSelectAllOption("All Above")).toBe(true);
        expect(isSelectAllOption("All options")).toBe(true);
        expect(isSelectAllOption("Everything")).toBe(true);
        expect(isSelectAllOption("Select all")).toBe(true);
        expect(isSelectAllOption("All")).toBe(true);
        expect(isSelectAllOption("Option A")).toBe(false);
    });
});
