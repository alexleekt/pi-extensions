import { useState } from "react";

interface AdditionalCommentsProps {
    onChange?: (value: string) => void;
    value?: string;
}

export default function AdditionalComments({ onChange, value: controlledValue }: AdditionalCommentsProps) {
    const [internalValue, setInternalValue] = useState("");
    const value = controlledValue !== undefined ? controlledValue : internalValue;
    const setValue = (v: string) => {
        if (controlledValue === undefined) setInternalValue(v);
        onChange?.(v);
    };

    return (
        <div className="mb-3">
            <div className="mb-1 text-sm font-medium">Additional Comments</div>
            <div className="mb-1 text-xs text-muted-foreground">Anything else you would like to share?</div>
            <textarea
                placeholder="Optional additional comments…"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none ring-offset-background focus:ring-2 focus:ring-ring resize-none"
                rows={3}
            />
        </div>
    );
}
