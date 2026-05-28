import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { RadioIcon, CheckIcon, HelpIcon, CommentIcon, isSelectAllOption } from "../icons";

describe("icons", () => {
    it("RadioIcon renders checked state", () => {
        const { container } = render(<RadioIcon checked={true} />);
        expect(container.querySelector("svg")).toBeInTheDocument();
        expect(container.querySelectorAll("circle")).toHaveLength(2);
    });

    it("RadioIcon renders unchecked state", () => {
        const { container } = render(<RadioIcon checked={false} />);
        expect(container.querySelectorAll("circle")).toHaveLength(1);
    });

    it("CheckIcon renders checked state", () => {
        const { container } = render(<CheckIcon checked={true} />);
        expect(container.querySelector("svg")).toBeInTheDocument();
        expect(container.querySelector("path")).toBeInTheDocument();
    });

    it("CheckIcon renders unchecked state", () => {
        const { container } = render(<CheckIcon checked={false} />);
        expect(container.querySelector("path")).not.toBeInTheDocument();
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
        expect(isSelectAllOption("select all")).toBe(true);
        expect(isSelectAllOption("All")).toBe(true);
        expect(isSelectAllOption("Everything")).toBe(true);
    });

    it("isSelectAllOption rejects non-select-all titles", () => {
        expect(isSelectAllOption("Option A")).toBe(false);
        expect(isSelectAllOption("None")).toBe(false);
        expect(isSelectAllOption("")).toBe(false);
    });
});
