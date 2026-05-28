import { describe, expect, it } from "vitest";
import { formatResponse } from "../response-formatter";

describe("formatResponse", () => {
    const question = "Test question?";
    const options = [
        { title: "Option A", description: "First option" },
        { title: "Option B" },
    ];

    describe("freeform", () => {
        it("includes additionalComments in response when provided", () => {
            const result = formatResponse(
                question,
                options,
                {
                    kind: "freeform",
                    text: "My answer",
                    additionalComments: "My extra thoughts",
                },
                false,
            );

            expect(result.details?.response?.kind).toBe("freeform");
            expect(result.details?.response?.text).toBe("My answer");
            expect(result.details?.response?.additionalComments).toBe(
                "My extra thoughts",
            );
            expect(result.content[0].text).toContain("My answer");
            expect(result.content[0].text).toContain(
                "Additional Comments: My extra thoughts",
            );
        });

        it("does not include additionalComments when not provided", () => {
            const result = formatResponse(
                question,
                options,
                { kind: "freeform", text: "My answer" },
                false,
            );

            expect(result.details?.response?.additionalComments).toBeUndefined();
            expect(result.content[0].text).toBe("My answer");
        });

        it("formats text with only additionalComments and no main text", () => {
            const result = formatResponse(
                question,
                options,
                {
                    kind: "freeform",
                    text: "",
                    additionalComments: "Only extra thoughts",
                },
                false,
            );

            expect(result.content[0].text).toBe(
                "Additional Comments: Only extra thoughts",
            );
        });

        it("returns 'No response' when freeform text and additionalComments are empty", () => {
            const result = formatResponse(
                question,
                options,
                { kind: "freeform", text: "" },
                false,
            );

            expect(result.content[0].text).toBe("No response");
        });
    });

    describe("selection", () => {
        it("includes additionalComments in response when provided", () => {
            const result = formatResponse(
                question,
                options,
                {
                    kind: "selection",
                    selections: ["Option A"],
                    comment: "My comment",
                    additionalComments: "My extra thoughts",
                },
                false,
            );

            expect(result.details?.response?.kind).toBe("selection");
            expect(result.details?.response?.selections).toEqual(["Option A"]);
            expect(result.details?.response?.comment).toBe("My comment");
            expect(result.details?.response?.additionalComments).toBe(
                "My extra thoughts",
            );
            expect(result.content[0].text).toContain("Option A");
            expect(result.content[0].text).toContain("Comment: My comment");
            expect(result.content[0].text).toContain(
                "Additional Comments: My extra thoughts",
            );
        });

        it("does not include additionalComments when not provided", () => {
            const result = formatResponse(
                question,
                options,
                { kind: "selection", selections: ["Option A"] },
                false,
            );

            expect(result.details?.response?.additionalComments).toBeUndefined();
        });
    });

    describe("questionnaire", () => {
        it("includes additionalComments in response when provided", () => {
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
                    additionalComments: "My extra thoughts",
                },
                false,
            );

            expect(result.details?.response?.kind).toBe("questionnaire");
            expect(result.details?.response?.additionalComments).toBe(
                "My extra thoughts",
            );
            expect(result.content[0].text).toContain(
                "Additional Comments: My extra thoughts",
            );
        });

        it("does not include additionalComments when not provided", () => {
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

            expect(result.details?.response?.additionalComments).toBeUndefined();
        });
    });

    describe("cancelled", () => {
        it("returns cancelled response even when additionalComments was present", () => {
            const result = formatResponse(
                question,
                options,
                {
                    kind: "freeform",
                    text: "My answer",
                    additionalComments: "My extra thoughts",
                },
                true,
            );

            expect(result.details?.cancelled).toBe(true);
            expect(result.details?.response).toBeNull();
            expect(result.content[0].text).toBe("Cancelled");
        });
    });
});
