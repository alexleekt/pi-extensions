import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        environment: "jsdom",
        globals: true,
        setupFiles: ["./webview/src/test-setup.ts"],
        include: ["webview/src/**/*.{test,spec}.{ts,tsx}"],
        coverage: {
            provider: "v8",
            include: ["webview/src/**/*.{ts,tsx}"],
            exclude: [
                "webview/src/**/*.test.{ts,tsx}",
                "webview/src/**/*.spec.{ts,tsx}",
                "webview/src/index.css",
                "webview/src/index.generated.css",
                "webview/src/test-setup.ts",
            ],
        },
    },
});
