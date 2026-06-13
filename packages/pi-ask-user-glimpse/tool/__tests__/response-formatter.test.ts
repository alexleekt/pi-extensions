import { describe, expect, it } from "vitest";
import { formatResponse } from "../response-formatter.js";

function textContent(result: ReturnType<typeof formatResponse>): string {
    const c = result.content[0];
    return c.type === "text" ? c.text : "";
}

describe("formatResponse", () => {
    const question = "Test question?";
    const options = [
        { title: "Option A", description: "First option" },
        { title: "Option B" },
    ];

    describe("freeform", () => {
        it("includes text in response", () => {
            const result = formatResponse(
                question,
                options,
                { kind: "freeform", text: "My answer" },
                false,
            );

            expect(result.details?.response?.kind).toBe("freeform");
            expect(result.details?.response?.text).toBe("My answer");
            expect(textContent(result)).toBe("My answer");
        });

        it("returns 'No response' when freeform text is empty", () => {
            const result = formatResponse(
                question,
                options,
                { kind: "freeform", text: "" },
                false,
            );

            expect(textContent(result)).toBe("No response");
        });

        it("includes comment in freeform response when provided", () => {
            const result = formatResponse(
                question,
                options,
                { kind: "freeform", text: "My answer", comment: "My comment" },
                false,
            );

            expect(result.details?.response?.kind).toBe("freeform");
            expect(result.details?.response?.text).toBe("My answer");
            expect(result.details?.response?.comment).toBe("My comment");
            expect(textContent(result)).toContain("My answer");
            expect(textContent(result)).toContain("Comment: My comment");
        });

        it("includes additionalComments in freeform response when provided", () => {
            const result = formatResponse(
                question,
                options,
                {
                    kind: "freeform",
                    text: "My answer",
                    additionalComments: "More details",
                },
                false,
            );

            expect(result.details?.response?.kind).toBe("freeform");
            expect(result.details?.response?.text).toBe("My answer");
            expect(result.details?.response?.additionalComments).toBe(
                "More details",
            );
            expect(textContent(result)).toContain("My answer");
            expect(textContent(result)).toContain(
                "Additional Comments: More details",
            );
        });
    });

    describe("selection", () => {
        it("includes comment in response when provided", () => {
            const result = formatResponse(
                question,
                options,
                {
                    kind: "selection",
                    selections: ["Option A"],
                    comment: "My comment",
                },
                false,
            );

            expect(result.details?.response?.kind).toBe("selection");
            expect(result.details?.response?.selections).toEqual(["Option A"]);
            expect(result.details?.response?.comment).toBe("My comment");
            expect(textContent(result)).toContain("Option A");
            expect(textContent(result)).toContain("Comment: My comment");
        });

        it("does not include comment when not provided", () => {
            const result = formatResponse(
                question,
                options,
                { kind: "selection", selections: ["Option A"] },
                false,
            );

            expect(result.details?.response?.comment).toBeUndefined();
        });

        it("includes additionalComments in selection response when provided", () => {
            const result = formatResponse(
                question,
                options,
                {
                    kind: "selection",
                    selections: ["Option A"],
                    additionalComments: "More context",
                },
                false,
            );

            expect(result.details?.response?.kind).toBe("selection");
            expect(result.details?.response?.selections).toEqual(["Option A"]);
            expect(result.details?.response?.additionalComments).toBe(
                "More context",
            );
            expect(textContent(result)).toContain("Option A");
            expect(textContent(result)).toContain(
                "Additional Comments: More context",
            );
        });

        it("handles single selection field instead of selections array", () => {
            const result = formatResponse(
                question,
                options,
                { kind: "selection", selection: "Option B" },
                false,
            );

            expect(result.details?.response?.kind).toBe("selection");
            expect(result.details?.response?.selections).toEqual(["Option B"]);
            expect(textContent(result)).toBe("Option B");
        });

        it("returns 'No response' when selection is empty", () => {
            const result = formatResponse(
                question,
                options,
                { kind: "selection", selections: [] },
                false,
            );

            expect(textContent(result)).toBe("No response");
        });
    });

    describe("questionnaire", () => {
        it("includes questionnaire details in response", () => {
            const result = formatResponse(
                question,
                options,
                {
                    kind: "questionnaire",
                    selections: ["Q1: A"],
                    questionnaireDetails: [
                        {
                            question: "Q1",
                            answer: "A",
                            kind: "selection" as const,
                        },
                    ],
                },
                false,
            );

            expect(result.details?.response?.kind).toBe("questionnaire");
            expect(result.details?.response?.questionnaireDetails).toEqual([
                { question: "Q1", answer: "A", kind: "selection" },
            ]);
        });

        it("includes additionalComments in questionnaire response when provided", () => {
            const result = formatResponse(
                question,
                options,
                {
                    kind: "questionnaire",
                    selections: ["Q1: A"],
                    questionnaireDetails: [
                        {
                            question: "Q1",
                            answer: "A",
                            kind: "selection" as const,
                        },
                    ],
                    additionalComments: "More context",
                },
                false,
            );

            expect(result.details?.response?.kind).toBe("questionnaire");
            expect(result.details?.response?.additionalComments).toBe(
                "More context",
            );
            expect(textContent(result)).toContain("Q1: A");
            expect(textContent(result)).toContain(
                "Additional Comments: More context",
            );
        });

        it("handles freeform questionnaire answers", () => {
            const result = formatResponse(
                question,
                options,
                {
                    kind: "questionnaire",
                    selections: ["Q1: Free answer"],
                    questionnaireDetails: [
                        {
                            question: "Q1",
                            answer: "Free answer",
                            kind: "freeform",
                            comment: "Extra note",
                        },
                    ],
                },
                false,
            );

            expect(result.details?.response?.kind).toBe("questionnaire");
            expect(result.details?.response?.questionnaireDetails).toEqual([
                {
                    question: "Q1",
                    answer: "Free answer",
                    kind: "freeform",
                    comment: "Extra note",
                },
            ]);
            expect(textContent(result)).toContain("Q1: Free answer");
            expect(textContent(result)).toContain("Comment: Extra note");
        });
    });

    describe("normalizeKind", () => {
        it("defaults to selection for unknown kind values", () => {
            const result = formatResponse(
                question,
                options,
                { kind: "unknown", selections: ["Option A"] },
                false,
            );

            expect(result.details?.response?.kind).toBe("selection");
        });
    });

    describe("cancelled", () => {
        it("returns cancelled response", () => {
            const result = formatResponse(
                question,
                options,
                { kind: "freeform", text: "My answer" },
                true,
            );

            expect(result.details?.cancelled).toBe(true);
            expect(result.details?.response).toBeNull();
            expect(textContent(result)).toBe("Cancelled");
        });
    });

    describe("null result", () => {
        it("returns 'No response' when result is null and not cancelled", () => {
            const result = formatResponse(question, options, null, false);

            expect(textContent(result)).toBe("No response");
            expect(result.details?.cancelled).toBe(false);
            expect(result.details?.response).toBeNull();
        });
    });
});
