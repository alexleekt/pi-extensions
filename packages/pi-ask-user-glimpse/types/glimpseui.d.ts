declare module "glimpseui" {
    export interface GlimpseWindowOptions {
        width?: number;
        height?: number;
        title?: string;
        frameless?: boolean;
        floating?: boolean;
        transparent?: boolean;
        clickThrough?: boolean;
        noDock?: boolean;
        hidden?: boolean;
        autoClose?: boolean;
        openLinks?: boolean;
        openLinksApp?: string;
        followCursor?: boolean;
        x?: number;
        y?: number;
        cursorOffset?: { x?: number; y?: number };
        cursorAnchor?: string;
        followMode?: "snap" | "spring";
        timeout?: number;
    }

    export interface GlimpseWindow {
        on(event: "message", handler: (data: unknown) => void): void;
        on(event: "closed", handler: () => void): void;
        on(event: "error", handler: (err: Error) => void): void;
        send(js: string): void;
        setHTML(html: string): void;
        show(options?: { title?: string }): void;
        close(): void;
        loadFile(path: string): void;
        getInfo(): unknown;
        followCursor(enabled: boolean, anchor?: string, mode?: string): void;
        readonly info: unknown;
    }

    export function open(
        html: string,
        options?: GlimpseWindowOptions,
    ): GlimpseWindow;
    export function prompt(
        html: string,
        options?: GlimpseWindowOptions,
    ): Promise<unknown | null>;
    export function statusItem(
        html: string,
        options?: GlimpseWindowOptions,
    ): GlimpseWindow;
    export function getNativeHostInfo(): {
        path: string;
        platform: string;
        buildHint: string;
    };
    export function supportsFollowCursor(): boolean;
    export function getFollowCursorSupport(): {
        supported: boolean;
        reason?: string;
    };
}
