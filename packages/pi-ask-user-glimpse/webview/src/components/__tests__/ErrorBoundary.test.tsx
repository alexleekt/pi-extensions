import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import ErrorBoundary from "../ErrorBoundary";

const mockSendToGlimpse = vi.fn();

vi.mock("../util/glimpse", () => ({
    sendToGlimpse: (...args: unknown[]) => mockSendToGlimpse(...args),
}));

function ThrowError() {
    throw new Error("Test error");
}

describe("ErrorBoundary", () => {
    it("renders children when no error", () => {
        render(
            <ErrorBoundary>
                <div>Normal content</div>
            </ErrorBoundary>,
        );
        expect(screen.getByText("Normal content")).toBeInTheDocument();
    });

    it("renders error UI when child throws", () => {
        const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
        const boundary = render(
            <ErrorBoundary>
                <ThrowError />
            </ErrorBoundary>,
        );
        expect(screen.getByText("Something went wrong")).toBeInTheDocument();
        expect(screen.getByText("Test error")).toBeInTheDocument();
        consoleSpy.mockRestore();
        boundary.unmount();
    });

});
