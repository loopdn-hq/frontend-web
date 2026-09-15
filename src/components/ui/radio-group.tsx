import { cva } from "class-variance-authority";
import { cn } from "@/lib/ui/cn";

export type RadioOption<T extends string = string> = {
  value: T;
  label: string;
  description?: string;
  disabled?: boolean;
};

type RadioGroupProps<T extends string = string> = {
  name: string;
  value: T;
  options: RadioOption<T>[];
  onChange: (value: T) => void;
  disabled?: boolean;
  orientation?: "vertical" | "horizontal";
  /**
   * "card" boxes each option. "plain" is a bare list, for a group that sits
   * inside something that already has a border - a settings card.
   */
  variant?: "card" | "plain";
  className?: string;
  /** Names the group - usually the id of the question's heading. */
  "aria-labelledby"?: string;
  "aria-describedby"?: string;
};

const optionVariants = cva("flex cursor-pointer items-start gap-3 transition", {
  variants: {
    variant: {
      card: "rounded-lg border border-slate-200 p-3 hover:border-sky-300 hover:bg-sky-50 dark:border-slate-700 dark:hover:bg-slate-800",
      plain: "py-1",
    },
    checked: {
      true: "",
      false: "",
    },
    disabled: {
      true: "cursor-not-allowed opacity-60",
      false: "",
    },
  },
  compoundVariants: [
    {
      variant: "card",
      checked: true,
      className:
        "border-sky-300 bg-sky-50 dark:border-sky-700 dark:bg-sky-950/30",
    },
  ],
  defaultVariants: {
    variant: "card",
    checked: false,
    disabled: false,
  },
});

export function RadioGroup<T extends string = string>({
  name,
  value,
  options,
  onChange,
  disabled = false,
  orientation = "vertical",
  variant = "card",
  className,
  "aria-labelledby": labelledBy,
  "aria-describedby": describedBy,
}: RadioGroupProps<T>) {
  const plain = variant === "plain";

  return (
    <div
      className={cn(
        orientation === "vertical"
          ? plain
            ? "space-y-0.5"
            : "space-y-2"
          : "grid grid-cols-1 gap-2 sm:grid-cols-2",
        className,
      )}
      role="radiogroup"
      aria-disabled={disabled}
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
    >
      {options.map((option) => {
        const checked = option.value === value;
        const isDisabled = disabled || option.disabled;

        return (
          <label
            key={option.value}
            className={cn(
              optionVariants({ variant, checked, disabled: isDisabled }),
            )}
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={checked}
              onChange={() => onChange(option.value)}
              disabled={isDisabled}
              className={cn(
                "h-4 w-4 cursor-pointer accent-sky-600",
                plain ? "mt-0.5" : "mt-1",
              )}
            />
            <span>
              <span
                className={cn(
                  "block text-slate-900 dark:text-slate-100",
                  plain ? "text-sm" : "font-medium",
                )}
              >
                {option.label}
              </span>
              {option.description && (
                <span className="block text-xs text-slate-600 dark:text-slate-400">
                  {option.description}
                </span>
              )}
            </span>
          </label>
        );
      })}
    </div>
  );
}
