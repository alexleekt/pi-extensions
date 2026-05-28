import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import OptionCard from "../OptionCard";

describe("OptionCard", () => {
    it("renders title and description", () => {
        render(
            <OptionCard
                title="Option A"
                description="Description for A"
                index={0}
                isSelected={false}
                isActive={false}
                mode="single"
                onClick={vi.fn()}
            />,
        );
        expect(screen.getByText("Option A")).toBeInTheDocument();
        expect(screen.getByText("Description for A")).toBeInTheDocument();
    });

    it("shows recommended badge when recommended is true", () => {
        render(
            <OptionCard
                title="Option A"
                index={0}
                isSelected={false}
                isActive={false}
                mode="single"
                onClick={vi.fn()}
                recommended={true}
            />,
        );
        expect(screen.getByText("Recommended")).toBeInTheDocument();
    });

    it("calls onClick when clicked", () => {
        const onClick = vi.fn();
        render(
            <OptionCard
                title="Option A"
                index={0}
                isSelected={false}
                isActive={false}
                mode="single"
                onClick={onClick}
            />,
        );
        fireEvent.click(screen.getByText("Option A"));
        expect(onClick).toHaveBeenCalledTimes(1);
    });

    it("calls onClick on Enter key", () => {
        const onClick = vi.fn();
        render(
            <OptionCard
                title="Option A"
                index={0}
                isSelected={false}
                isActive={false}
                mode="single"
                onClick={onClick}
            />,
        );
        const card = screen.getByText("Option A").closest("[role='option']") as HTMLElement;
        fireEvent.keyDown(card, { key: "Enter" });
        expect(onClick).toHaveBeenCalledTimes(1);
    });

    it("calls onClick on Space key", () => {
        const onClick = vi.fn();
        render(
            <OptionCard
                title="Option A"
                index={0}
                isSelected={false}
                isActive={false}
                mode="single"
                onClick={onClick}
            />,
        );
        const card = screen.getByText("Option A").closest("[role='option']") as HTMLElement;
        fireEvent.keyDown(card, { key: " " });
        expect(onClick).toHaveBeenCalledTimes(1);
    });

    it("renders radio icon for single mode", () => {
        render(
            <OptionCard
                title="Option A"
                index={0}
                isSelected={false}
                isActive={false}
                mode="single"
                onClick={vi.fn()}
            />,
        );
        const card = screen.getByText("Option A").closest("[role='option']") as HTMLElement;
        expect(card.querySelector("svg")).toBeInTheDocument();
    });

    it("renders checkbox for multi mode", () => {
        render(
            <OptionCard
                title="Option A"
                index={0}
                isSelected={false}
                isActive={false}
                mode="multi"
                onClick={vi.fn()}
            />,
        );
        const card = screen.getByText("Option A").closest("[role='option']") as HTMLElement;
        expect(card.querySelector("div[class*='rounded']")).toBeInTheDocument();
    });
});
