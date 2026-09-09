import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/ui/cn";

const selectVariants = cva(
  "w-full appearance-none rounded-xl border bg-white px-4 py-3 pr-10 text-sm text-slate-800 outline-none transition focus:border-sky-500 focus:ring-4 focus:ring-sky-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100",
  {
    variants: {
      state: {
        default: "border-slate-200",
        error: "border-rose-300 focus:border-rose-500 focus:ring-rose-100",
      },
    },
    defaultVariants: {
      state: "default",
    },
  },
);

export type SelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

export type SelectProps = Omit<
  React.SelectHTMLAttributes<HTMLSelectElement>,
  "children"
> &
  VariantProps<typeof selectVariants> & {
    options: SelectOption[];
    placeholder?: string;
  };

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  (
    { className, state, options, placeholder, value, defaultValue, ...props },
    ref,
  ) => {
    return (
      <div className="relative">
        <select
          ref={ref}
          className={cn(selectVariants({ state }), className)}
          value={value}
          defaultValue={defaultValue}
          {...props}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((option) => (
            <option
              key={option.value}
              value={option.value}
              disabled={option.disabled}
            >
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      </div>
    );
  },
);

Select.displayName = "Select";
