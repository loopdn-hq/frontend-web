import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/ui/cn";

const inputVariants = cva(
  "w-full rounded-xl border bg-white px-4 py-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-4 focus:ring-sky-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100",
  {
    variants: {
      state: {
        default: "border-slate-200",
        error: "border-rose-300 focus:border-rose-500 focus:ring-rose-100",
      },
      uppercaseTracking: {
        true: "uppercase tracking-widest placeholder:normal-case placeholder:tracking-normal",
        false: "",
      },
    },
    defaultVariants: {
      state: "default",
      uppercaseTracking: false,
    },
  },
);

export type InputProps = React.InputHTMLAttributes<HTMLInputElement> &
  VariantProps<typeof inputVariants>;

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, state, uppercaseTracking, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={cn(inputVariants({ state, uppercaseTracking }), className)}
        {...props}
      />
    );
  },
);

Input.displayName = "Input";
