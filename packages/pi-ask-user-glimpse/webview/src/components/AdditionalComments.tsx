interface AdditionalCommentsProps {
    value: string;
    onChange: (value: string) => void;
}

export default function AdditionalComments({ value, onChange }: AdditionalCommentsProps) {
    return (
        <div className="mb-3">
            <div className="mb-1 text-sm font-medium">Additional Comments</div>
            <div className="mb-1 text-xs text-muted-foreground">Anything else you would like to share?</div>
            <textarea
                placeholder="Optional additional comments…"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none ring-offset-background focus:ring-2 focus:ring-ring resize-none"
                rows={3}
            />
        </div>
    );
}
