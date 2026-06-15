import { forwardRef } from "react";

/**
 * AdditionalComments — global, always-present textarea for supplementary user input.
 *
 * ## Invariant
 * This component MUST be rendered unconditionally in every dialog style
 * (select, multi-select, questionnaire, freeform). It is NOT gated by any
 * payload flag — particularly NOT by `allowComment` (which controls
 * per-option toggle comments, a separate concern).
 *
 * If you need to conditionally hide this section, discuss with the team first
 * and update the invariant test in the component test files.
 *
 * @see [[ask-user-form-unified-empty-submit-pattern]] in project memex
 */

interface AdditionalCommentsProps {
    value: string;
    onChange: (value: string) => void;
}

const AdditionalComments = forwardRef<HTMLTextAreaElement, AdditionalCommentsProps>(
    ({ value, onChange }, ref) => {
        return (
            <div>
                <div className="mb-1 text-sm font-medium">Additional Comments</div>
                <div className="mb-1 text-xs text-muted-foreground">Anything else you would like to share?</div>
                <textarea
                    ref={ref}
                    placeholder="Optional additional comments…"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none ring-offset-background focus:ring-2 focus:ring-ring resize-none"
                    rows={3}
                />
            </div>
        );
    },
);

AdditionalComments.displayName = "AdditionalComments";

export default AdditionalComments;
