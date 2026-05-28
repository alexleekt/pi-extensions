import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { useFooterPortal } from "../FooterContext";

function TestComponent() {
    useFooterPortal(<div>Test footer</div>);
    return <div>Test</div>;
}

describe("FooterContext", () => {
    it("useFooterPortal returns early when context is missing", () => {
        const { container } = render(<TestComponent />);
        expect(container.textContent).toContain("Test");
    });
});
