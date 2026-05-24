import { createContext, useContext, useEffect, type ReactNode } from "react";

interface FooterContextValue {
    setFooter: (node: ReactNode | null) => void;
}

export const FooterContext = createContext<FooterContextValue | null>(null);

/** Call this from dialog components to render their footer at the App-level footer bar. */
export function useFooterPortal(footerNode: ReactNode) {
    const ctx = useContext(FooterContext);
    if (!ctx) {
        // Fallback: context not available (e.g., in tests or no-context mode)
        return;
    }
    useEffect(() => {
        ctx.setFooter(footerNode);
        return () => ctx.setFooter(null);
    }, [ctx, footerNode]);
}
