import { forwardRef, KeyboardEvent } from "react";
import { CheckIcon, RadioIcon, isSelectAllOption } from "./icons";
import RichText from "./RichText";

interface OptionCardProps {
    title: string;
    description?: string;
    index: number;
    isSelected: boolean;
    isActive: boolean;
    mode: "single" | "multi";
    onClick: () => void;
    recommended?: boolean;
    tabIndex?: number;
    "data-question"?: string;
    "data-option"?: string;
}

const OptionCard = forwardRef<HTMLDivElement, OptionCardProps>(
    (
        {
            title,
            description,
            index,
            isSelected,
            isActive,
            mode,
            onClick,
            recommended,
            tabIndex,
            "data-question": dataQuestion,
            "data-option": dataOption,
        },
        ref,
    ) => {
        const isSelectAll = isSelectAllOption(title);
        const role = isSelectAll ? "radio" : mode === "single" ? "option" : "checkbox";
        const ariaState = isSelectAll
            ? { "aria-selected": isSelected }
            : mode === "single"
              ? { "aria-selected": isSelected }
              : { "aria-checked": isSelected };

        const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
            if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick();
            }
        };

        return (
            <div
                ref={ref}
                tabIndex={tabIndex}
                onClick={onClick}
                onKeyDown={handleKeyDown}
                role={role}
                {...ariaState}
                data-question={dataQuestion}
                data-option={dataOption}
                className={`flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                    isSelected
                        ? "border-primary bg-primary/5"
                        : "border-border bg-card hover:bg-accent"
                } ${isActive ? "ring-2 ring-ring" : ""}`}
            >
                {/* Selection icon */}
                {isSelectAll ? (
                    <RadioIcon checked={isSelected} />
                ) : mode === "single" ? (
                    <RadioIcon checked={isSelected} />
                ) : (
                    <div
                        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded ${
                            isSelected
                                ? "bg-primary text-primary-foreground"
                                : "border border-border"
                        }`}
                    >
                        {isSelected && <CheckIcon checked={true} />}
                    </div>
                )}

                {/* Number badge */}
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground">
                    {index + 1}
                </span>

                {/* Text content */}
                <div className="min-w-0">
                    <div className="flex items-center gap-2">
                        <RichText
                            text={title}
                            className="font-medium"
                        />
                        {recommended && (
                            <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                                Recommended
                            </span>
                        )}
                    </div>
                    {description && (
                        <RichText
                            text={description}
                            className="mt-0.5 text-sm text-muted-foreground border-l-2 border-muted-foreground/30 pl-2.5"
                        />
                    )}
                </div>
            </div>
        );
    },
);

OptionCard.displayName = "OptionCard";

export default OptionCard;
