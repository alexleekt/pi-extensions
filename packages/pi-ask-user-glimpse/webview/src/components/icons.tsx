export function RadioIcon({ checked }: { checked: boolean }) {
    return (
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="shrink-0 text-primary">
            <circle cx="10" cy="10" r="9" stroke="currentColor" strokeWidth="2" />
            {checked && <circle cx="10" cy="10" r="5" fill="currentColor" />}
        </svg>
    );
}

export function CheckIcon({ checked }: { checked: boolean }) {
    return (
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="shrink-0">
            <rect x="1" y="1" width="18" height="18" rx="4" stroke="currentColor" strokeWidth="2"
                className={checked ? "text-primary" : "text-border"} />
            {checked && (
                <path d="M5 10l4 4 6-7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                    className="text-primary-foreground" />
            )}
        </svg>
    );
}

export function CommentIcon() {
    return (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"
            strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 10.5V4a1.5 1.5 0 0 0-1.5-1.5H3.5A1.5 1.5 0 0 0 2 4v6.5A1.5 1.5 0 0 0 3.5 12H5v2l2.5-2H12.5a1.5 1.5 0 0 0 1.5-1.5z" />
        </svg>
    );
}

const SELECT_ALL_PATTERNS = /^(all of the above|all above|all options|everything|select all|all)$/;

export function isSelectAllOption(title: string): boolean {
    return SELECT_ALL_PATTERNS.test(title.toLowerCase().trim());
}
