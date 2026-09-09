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
  className?: string;
};

const optionVariants = cva(
  "flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 p-3 transition hover:border-sky-300 hover:bg-sky-50 dark:border-slate-700 dark:hover:bg-slate-800",
  {
    variants: {
      checked: {
        true: "border-sky-300 bg-sky-50 dark:border-sky-700 dark:bg-sky-950/30",
        false: "",
      },
      disabled: {
        true: "cursor-not-allowed opacity-60",
        false: "",
      },
    },
    defaultVariants: {
      checked: false,
      disabled: false,
    },
  },
);

export function RadioGroup<T extends string = string>({
  name,
  value,
  options,
  onChange,
  disabled = false,
  orientation = "vertical",
  className,
}: RadioGroupProps<T>) {
  return (
    <div
      className={cn(
        orientation === "vertical"
          ? "space-y-2"
          : "grid grid-cols-1 gap-2 sm:grid-cols-2",
        className,
      )}
      role="radiogroup"
      aria-disabled={disabled}
    >
      {options.map((option) => {
        const checked = option.value === value;
        const isDisabled = disabled || option.disabled;

        return (
          <label
            key={option.value}
            className={cn(optionVariants({ checked, disabled: isDisabled }))}
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={checked}
              onChange={() => onChange(option.value)}
              disabled={isDisabled}
              className="mt-1 h-4 w-4 cursor-pointer accent-sky-600"
            />
            <span>
              <span className="block font-medium text-slate-900 dark:text-slate-100">
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
