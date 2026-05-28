import { Component, type ReactNode } from "react";
import { sendToGlimpse } from "../util/glimpse";

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
    error?: Error;
}

export default class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError(error: Error): State {
        // eslint-disable-next-line no-console
        console.error("[ErrorBoundary] Caught error:", error.message, error.stack);
        return { hasError: true, error };
    }

    componentDidCatch(error: Error) {
        // Notify the host so the tool doesn't hang forever
        try {
            sendToGlimpse({
                __error: true,
                message: error.message,
            });
        } catch {
            // If the bridge is down, we can't do anything
        }
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="flex h-full items-center justify-center p-4">
                    <div className="rounded-lg border border-destructive bg-destructive/10 p-4 text-destructive max-w-md">
                        <h2 className="font-semibold mb-1">
                            Something went wrong
                        </h2>
                        <p className="text-sm opacity-90">
                            {this.state.error?.message ??
                                "An unexpected error occurred."}
                        </p>
                    </div>
                </div>
            );
        }
        return this.props.children;
    }
}
