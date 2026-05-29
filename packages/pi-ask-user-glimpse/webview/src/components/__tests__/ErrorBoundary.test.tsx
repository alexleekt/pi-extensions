import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import ErrorBoundary from "../ErrorBoundary";

const mockSendToGlimpse = vi.hoisted(() => vi.fn());

vi.mock("../../util/glimpse", () => ({
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

    it("notifies host via sendToGlimpse when error is caught", () => {
        const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
        // Instantiate ErrorBoundary directly to call componentDidCatch
        const boundary = new ErrorBoundary({ children: null });
        const error = new Error("Host notification error");
        boundary.componentDidCatch(error);
        expect(mockSendToGlimpse).toHaveBeenCalledWith({
            __error: true,
            message: "Host notification error",
        });
        consoleSpy.mockRestore();
    });

    it("handles sendToGlimpse failure gracefully", () => {
        const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
        mockSendToGlimpse.mockClear();
        mockSendToGlimpse.mockImplementationOnce(() => {
            throw new Error("Bridge down");
        });
        const boundary = new ErrorBoundary({ children: null });
        const error = new Error("Host notification error");
        // Should not throw even if sendToGlimpse fails
        expect(() => boundary.componentDidCatch(error)).not.toThrow();
        expect(mockSendToGlimpse).toHaveBeenCalledTimes(1);
        consoleSpy.mockRestore();
    });

});
