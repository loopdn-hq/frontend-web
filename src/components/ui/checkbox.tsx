import * as React from "react";
import { cn } from "@/lib/ui/cn";

type CheckboxProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "type"
> & {
  label?: React.ReactNode;
  description?: React.ReactNode;
  containerClassName?: string;
  labelClassName?: string;
  descriptionClassName?: string;
};

export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  (
    {
      className,
      label,
      description,
      containerClassName,
      labelClassName,
      descriptionClassName,
      ...props
    },
    ref,
  ) => {
    const checkbox = (
      <input
        ref={ref}
        type="checkbox"
        className={cn(
          "mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-sky-600 accent-sky-600 focus:ring-sky-500 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-600 dark:bg-slate-800",
          className,
        )}
        {...props}
      />
    );

    if (!label && !description) {
      return checkbox;
    }

    return (
      <label
        className={cn(
          "flex items-start gap-3 rounded-lg border border-slate-200 p-3 hover:border-sky-300 hover:bg-sky-50 dark:border-slate-700 dark:hover:border-sky-700 dark:hover:bg-sky-950/30",
          props.disabled && "cursor-not-allowed opacity-70",
          containerClassName,
        )}
      >
        {checkbox}
        <span className="space-y-0.5">
          {label && (
            <span
              className={cn(
                "block text-sm font-medium text-slate-900 dark:text-slate-100",
                labelClassName,
              )}
            >
              {label}
            </span>
          )}
          {description && (
            <span
              className={cn(
                "block text-xs text-slate-600 dark:text-slate-400",
                descriptionClassName,
              )}
            >
              {description}
            </span>
          )}
        </span>
      </label>
    );
  },
);

Checkbox.displayName = "Checkbox";
