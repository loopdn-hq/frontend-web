import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/ui/cn";

const textareaVariants = cva(
  "w-full rounded-xl border bg-white px-4 py-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-4 focus:ring-sky-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100",
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

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> &
  VariantProps<typeof textareaVariants>;

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, state, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        className={cn(textareaVariants({ state }), className)}
        {...props}
      />
    );
  },
);

Textarea.displayName = "Textarea";
