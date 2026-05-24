import { test, expect } from "@playwright/test";
import { readFileSync } from "fs";

const html = readFileSync("./dist/index.html", "utf-8");

function buildPayload(type: string, overrides = {}) {
    return {
        type,
        question: "Test question?",
        options: [
            { title: "Option A", description: "First option" },
            { title: "Option B", description: "Second option" },
            { title: "Option C" },
        ],
        allowComment: true,
        allowFreeform: true,
        ...overrides,
    };
}

function injectPayload(html: string, payload: unknown) {
    return html.replace(
        "<script",
        `<script>window.__ASK_USER_PAYLOAD__ = ${JSON.stringify(payload)};</script><script`,
    );
}

test.describe("pi-ask-user-glimpse dialog", () => {
    test.beforeEach(async ({ page }) => {
        const payload = buildPayload("single-select");
        const content = injectPayload(html, payload);
        await page.setContent(content);
    });

    test("renders question and options", async ({ page }) => {
        await expect(page.getByText("Test question?")).toBeVisible();
        await expect(page.getByText("Option A")).toBeVisible();
        await expect(page.getByText("Option B")).toBeVisible();
        await expect(page.getByText("Option C")).toBeVisible();
    });

    test("keyboard navigation with arrow keys", async ({ page }) => {
        const firstOption = page.locator("button[role='option']").first();
        await expect(firstOption).toBeFocused();

        await page.keyboard.press("ArrowDown");
        const secondOption = page.locator("button[role='option']").nth(1);
        await expect(secondOption).toBeFocused();

        await page.keyboard.press("ArrowUp");
        await expect(firstOption).toBeFocused();
    });

    test("number key selects option", async ({ page }) => {
        await page.click("body");
        await page.keyboard.press("1");
        const firstOption = page.locator("button[role='option']").first();
        await expect(firstOption).toHaveAttribute("aria-selected", "true");
    });

    test("Enter submits selected option", async ({ page }) => {
        await page.keyboard.press("1");
        await page.keyboard.press("Enter");

        // Wait for the message to be posted (we can't easily intercept in Playwright,
        // but we can check the button state changes)
        await expect(page.getByText("Submitting…")).toBeVisible();
    });

    test("Escape blurs textarea when focused", async ({ page }) => {
        // Click into additional comments textarea
        const textarea = page.locator("textarea").last();
        await textarea.click();
        await expect(textarea).toBeFocused();

        await page.keyboard.press("Escape");
        await expect(textarea).not.toBeFocused();
    });

    test("footer shows keyboard hints", async ({ page }) => {
        // Hint labels (small text in the keyboard hint bar)
        const hint = page.locator(".flex-wrap"); // KeyboardHint container
        await expect(hint.getByText("Esc")).toBeVisible();
        await expect(hint.getByText("cancel", { exact: true })).toBeVisible();
        await expect(hint.getByText("navigate")).toBeVisible();
        await expect(hint.getByText("submit", { exact: true })).toBeVisible();
    });

    test("minus key selects freeform option without submitting", async ({ page }) => {
        await page.click("body");
        await page.keyboard.press("-");

        const freeformOption = page.locator("button[role='option']").filter({ hasText: "My answer isn't listed above" });
        await expect(freeformOption).toHaveAttribute("aria-selected", "true");
        await expect(page.getByText("Submitting…")).not.toBeVisible();
    });

    test("Enter on freeform only selects, does not submit", async ({ page }) => {
        // Navigate to freeform option
        const freeformOption = page.locator("button[role='option']").filter({ hasText: "My answer isn't listed above" });
        await freeformOption.focus();
        await page.keyboard.press("Enter");

        await expect(freeformOption).toHaveAttribute("aria-selected", "true");
        await expect(page.getByText("Submitting…")).not.toBeVisible();
    });

    test("submit button works with freeform selected", async ({ page }) => {
        await page.click("body");
        await page.keyboard.press("-");

        const freeformOption = page.locator("button[role='option']").filter({ hasText: "My answer isn't listed above" });
        await expect(freeformOption).toHaveAttribute("aria-selected", "true");

        await page.getByRole("button", { name: "Submit" }).click();
        await expect(page.getByText("Submitting…")).toBeVisible();
    });

    test("footer shows not-listed hint when freeform is enabled", async ({ page }) => {
        const hint = page.locator(".flex-wrap"); // KeyboardHint container
        await expect(hint.getByText("-")).toBeVisible();
        await expect(hint.getByText("not listed")).toBeVisible();
    });

    test("Cancel button triggers confirm when dirty", async ({ page }) => {
        // Click the first option to select it
        const firstOption = page.locator("button[role='option']").first();
        await firstOption.click();
        await expect(firstOption).toHaveAttribute("aria-selected", "true");

        // Click cancel
        await page.getByRole("button", { name: "Cancel" }).click();

        // Confirm modal should appear
        await expect(page.getByRole("heading", { name: "Unsaved changes" })).toBeVisible();
        await expect(page.getByRole("button", { name: "Stay" })).toBeVisible();
        await expect(page.getByRole("button", { name: "Discard" })).toBeVisible();
    });
});

test.describe("multi-select dialog", () => {
    test("space toggles option selection", async ({ page }) => {
        const payload = buildPayload("multi-select");
        const content = injectPayload(html, payload);
        await page.setContent(content);

        const firstOption = page.locator("button[role='option']").first();
        await firstOption.focus();

        await page.keyboard.press("Space");
        // Check icon should be visible (checkmark)
        await expect(page.locator("svg").first()).toBeVisible();
    });

    test("minus key toggles freeform option without submitting", async ({ page }) => {
        const payload = buildPayload("multi-select");
        const content = injectPayload(html, payload);
        await page.setContent(content);

        await page.click("body");
        await page.keyboard.press("-");

        const freeformOption = page.locator("button[role='option']").filter({ hasText: "My answer isn't listed above" });
        await expect(freeformOption).toHaveAttribute("aria-selected", "true");
        await expect(page.getByText("Submitting…")).not.toBeVisible();
    });

    test("multi-select footer shows not-listed hint", async ({ page }) => {
        const payload = buildPayload("multi-select");
        const content = injectPayload(html, payload);
        await page.setContent(content);

        const hint = page.locator(".flex-wrap");
        await expect(hint.getByText("-")).toBeVisible();
        await expect(hint.getByText("not listed")).toBeVisible();
    });
});
