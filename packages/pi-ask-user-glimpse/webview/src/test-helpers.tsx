import { useState, type ReactNode } from "react";
import { FooterContext } from "./components/FooterContext";

/**
 * Test wrapper that provides a FooterContext so `useFooterPortal`
 * renders the DialogFooter inline below the component under test.
 */
export function WithFooterProvider({ children }: { children: ReactNode }) {
    const [footerNode, setFooterNode] = useState<ReactNode>(null);
    return (
        <FooterContext.Provider value={{ setFooter: setFooterNode }}>
            <div data-testid="component-root">{children}</div>
            <div data-testid="footer-portal">{footerNode}</div>
        </FooterContext.Provider>
    );
}
