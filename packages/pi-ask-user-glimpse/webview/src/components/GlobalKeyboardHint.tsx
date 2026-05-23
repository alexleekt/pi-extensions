import type { AskUserPayload } from "../../../shared/ask-user";
import { modKey } from "../util/platform";
import KeyboardHint from "./KeyboardHint";

interface GlobalKeyboardHintProps {
    payload: AskUserPayload;
}

/** Renders the appropriate keyboard shortcuts bar for the current dialog type.
 *  Intended to be placed inside DialogFooter — no wrapper borders or padding. */
export default function GlobalKeyboardHint({ payload }: GlobalKeyboardHintProps) {
    switch (payload.type) {
        case "single-select":
            return (
                <KeyboardHint
                    items={[
                        { keys: ["Esc"], label: "cancel" },
                        { keys: ["↑", "↓"], label: "navigate" },
                        { keys: ["1", "…", "9"], label: "select" },
                        { keys: ["Enter"], label: "choose" },
                        { keys: [modKey(), "Enter"], label: "submit" },
                        { keys: ["0"], label: "comments" },
                    ]}
                />
            );
        case "multi-select":
            return (
                <KeyboardHint
                    items={[
                        { keys: ["Esc"], label: "cancel" },
                        { keys: ["↑", "↓"], label: "navigate" },
                        { keys: ["1", "…", "9"], label: "toggle" },
                        { keys: ["Enter"], label: "choose" },
                        { keys: ["Space"], label: "toggle" },
                        { keys: [modKey(), "Enter"], label: "submit" },
                        { keys: ["0"], label: "comments" },
                    ]}
                />
            );
        case "questionnaire":
            return (
                <KeyboardHint
                    items={[
                        { keys: ["Esc"], label: "cancel" },
                        { keys: ["1", "…", "9"], label: "per question" },
                        { keys: ["0"], label: "comments" },
                        { keys: ["Tab"], label: "next" },
                        { keys: [modKey(), "Enter"], label: "submit" },
                    ]}
                />
            );
        case "freeform":
            return (
                <KeyboardHint
                    items={[
                        { keys: ["Esc"], label: "cancel" },
                        { keys: [modKey(), "Enter"], label: "submit" },
                    ]}
                />
            );
        default:
            return null;
    }
}
