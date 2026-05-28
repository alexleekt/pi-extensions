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

test.describe("single-select dialog", () => {
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

    test("renders additional comments textarea", async ({ page }) => {
        await expect(page.getByText("Additional Comments")).toBeVisible();
        await expect(
            page.getByPlaceholder("Optional additional comments…"),
        ).toBeVisible();
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
        await expect(page.getByText("Submitting…")).toBeVisible();
    });

    test("Escape blurs textarea when focused", async ({ page }) => {
        const textarea = page.locator("textarea").last();
        await textarea.click();
        await expect(textarea).toBeFocused();

        await page.keyboard.press("Escape");
        await expect(textarea).not.toBeFocused();
    });

    test("footer shows keyboard hints", async ({ page }) => {
        const hint = page.locator(".flex-wrap");
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
        const hint = page.locator(".flex-wrap");
        await expect(hint.getByText("-")).toBeVisible();
        await expect(hint.getByText("not listed")).toBeVisible();
    });

    test("Cancel button triggers confirm when dirty from selection", async ({ page }) => {
        const firstOption = page.locator("button[role='option']").first();
        await firstOption.click();
        await expect(firstOption).toHaveAttribute("aria-selected", "true");

        await page.getByRole("button", { name: "Cancel" }).click();
        await expect(page.getByRole("heading", { name: "Unsaved changes" })).toBeVisible();
    });

    test("Cancel triggers confirm when dirty from additional comments alone", async ({ page }) => {
        const commentsTextarea = page.getByPlaceholder("Optional additional comments…");
        await commentsTextarea.fill("Dirty comment");

        await page.getByRole("button", { name: "Cancel" }).click();
        await expect(page.getByRole("heading", { name: "Unsaved changes" })).toBeVisible();
    });

    test("0 key focuses additional comments", async ({ page }) => {
        await page.click("body");
        await page.keyboard.press("0");
        const commentsTextarea = page.getByPlaceholder("Optional additional comments…");
        await expect(commentsTextarea).toBeFocused();
    });

    test("submits with additional comments when typed", async ({ page }) => {
        await page.keyboard.press("1");

        const commentsTextarea = page.getByPlaceholder("Optional additional comments…");
        await commentsTextarea.fill("My extra thoughts");

        await page.getByRole("button", { name: "Submit" }).click();
        await expect(page.getByText("Submitting…")).toBeVisible();
    });
});

test.describe("multi-select dialog", () => {
    test.beforeEach(async ({ page }) => {
        const payload = buildPayload("multi-select");
        const content = injectPayload(html, payload);
        await page.setContent(content);
    });

    test("renders options and additional comments", async ({ page }) => {
        await expect(page.getByText("Option A")).toBeVisible();
        await expect(page.getByText("Additional Comments")).toBeVisible();
        await expect(
            page.getByPlaceholder("Optional additional comments…"),
        ).toBeVisible();
    });

    test("space toggles option selection", async ({ page }) => {
        const firstOption = page.locator("button[role='option']").first();
        await firstOption.focus();

        await page.keyboard.press("Space");
        await expect(page.locator("svg").first()).toBeVisible();
    });

    test("minus key toggles freeform option without submitting", async ({ page }) => {
        await page.click("body");
        await page.keyboard.press("-");

        const freeformOption = page.locator("button[role='option']").filter({ hasText: "My answer isn't listed above" });
        await expect(freeformOption).toHaveAttribute("aria-selected", "true");
        await expect(page.getByText("Submitting…")).not.toBeVisible();
    });

    test("multi-select footer shows not-listed hint", async ({ page }) => {
        const hint = page.locator(".flex-wrap");
        await expect(hint.getByText("-")).toBeVisible();
        await expect(hint.getByText("not listed")).toBeVisible();
    });

    test("Cancel triggers confirm when dirty from additional comments alone", async ({ page }) => {
        const commentsTextarea = page.getByPlaceholder("Optional additional comments…");
        await commentsTextarea.fill("Dirty comment");

        await page.getByRole("button", { name: "Cancel" }).click();
        await expect(page.getByRole("heading", { name: "Unsaved changes" })).toBeVisible();
    });

    test("submits with selections and additional comments", async ({ page }) => {
        await page.locator("button[role='option']").first().click();
        await page.locator("button[role='option']").nth(1).click();

        const commentsTextarea = page.getByPlaceholder("Optional additional comments…");
        await commentsTextarea.fill("My extra thoughts");

        await page.getByRole("button", { name: "Submit" }).click();
        await expect(page.getByText("Submitting…")).toBeVisible();
    });
});

test.describe("freeform dialog", () => {
    test.beforeEach(async ({ page }) => {
        const payload = buildPayload("freeform", { options: [] });
        const content = injectPayload(html, payload);
        await page.setContent(content);
    });

    test("renders textarea and additional comments", async ({ page }) => {
        await expect(page.getByPlaceholder("Type your answer…")).toBeVisible();
        await expect(page.getByText("Additional Comments")).toBeVisible();
        await expect(
            page.getByPlaceholder("Optional additional comments…"),
        ).toBeVisible();
    });

    test("submits with text and additional comments", async ({ page }) => {
        const mainTextarea = page.getByPlaceholder("Type your answer…");
        await mainTextarea.fill("My main answer");

        const commentsTextarea = page.getByPlaceholder("Optional additional comments…");
        await commentsTextarea.fill("My extra thoughts");

        await page.getByRole("button", { name: "Submit" }).click();
        await expect(page.getByText("Submitting…")).toBeVisible();
    });

    test("Cancel triggers confirm when dirty from main text", async ({ page }) => {
        const mainTextarea = page.getByPlaceholder("Type your answer…");
        await mainTextarea.fill("Dirty text");

        await page.getByRole("button", { name: "Cancel" }).click();
        await expect(page.getByRole("heading", { name: "Unsaved changes" })).toBeVisible();
    });

    test("Cancel triggers confirm when dirty from additional comments alone", async ({ page }) => {
        const commentsTextarea = page.getByPlaceholder("Optional additional comments…");
        await commentsTextarea.fill("Dirty comment");

        await page.getByRole("button", { name: "Cancel" }).click();
        await expect(page.getByRole("heading", { name: "Unsaved changes" })).toBeVisible();
    });

    test("does not show cancel confirm when clean", async ({ page }) => {
        await page.getByRole("button", { name: "Cancel" }).click();
        await expect(page.getByRole("heading", { name: "Unsaved changes" })).not.toBeVisible();
    });
});

test.describe("questionnaire dialog", () => {
    test.beforeEach(async ({ page }) => {
        const payload = buildPayload("questionnaire", {
            options: [],
            questions: [
                {
                    title: "Q1",
                    description: "First question",
                    options: [
                        { title: "Q1-A" },
                        { title: "Q1-B" },
                    ],
                    allowMultiple: false,
                },
                {
                    title: "Q2",
                    description: "Second question",
                    options: [
                        { title: "Q2-A" },
                        { title: "Q2-B" },
                    ],
                    allowMultiple: true,
                },
                {
                    title: "Q3",
                    description: "Freeform question",
                },
            ],
        });
        const content = injectPayload(html, payload);
        await page.setContent(content);
    });

    test("renders questions and additional comments", async ({ page }) => {
        await expect(page.getByText("Q1", { exact: true })).toBeVisible();
        await expect(page.getByText("Q2", { exact: true })).toBeVisible();
        await expect(page.getByText("Q3", { exact: true })).toBeVisible();
        await expect(page.getByText("Additional Comments")).toBeVisible();
        await expect(
            page.getByPlaceholder("Optional additional comments…"),
        ).toBeVisible();
    });

    test("submits with answers and additional comments", async ({ page }) => {
        await page.getByText("Q1-A").click();
        await page.getByText("Q2-A").click();
        await page.getByText("Q2-B").click();

        const freeformTextarea = page.getByPlaceholder("Your answer…");
        await freeformTextarea.fill("Freeform answer");

        const commentsTextarea = page.getByPlaceholder("Optional additional comments…");
        await commentsTextarea.fill("My extra thoughts");

        await page.getByRole("button", { name: "Submit" }).click();
        await expect(page.getByText("Submitting…")).toBeVisible();
    });

    test("Cancel triggers confirm when dirty from additional comments alone", async ({ page }) => {
        const commentsTextarea = page.getByPlaceholder("Optional additional comments…");
        await commentsTextarea.fill("Dirty comment");

        await page.getByRole("button", { name: "Cancel" }).click();
        await expect(page.getByRole("heading", { name: "Unsaved changes" })).toBeVisible();
    });

    test("Cancel triggers confirm when dirty from answers", async ({ page }) => {
        await page.getByText("Q1-A").click();
        await page.getByRole("button", { name: "Cancel" }).click();
        await expect(page.getByRole("heading", { name: "Unsaved changes" })).toBeVisible();
    });

    test("does not show cancel confirm when clean", async ({ page }) => {
        await page.getByRole("button", { name: "Cancel" }).click();
        await expect(page.getByRole("heading", { name: "Unsaved changes" })).not.toBeVisible();
    });
});
