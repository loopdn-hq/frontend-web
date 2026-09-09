import type { ReactNode } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/ui/cn";

const alertVariants = cva("rounded-xl px-3 py-2 text-sm", {
  variants: {
    variant: {
      error: "bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-300",
      success:
        "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300",
      info: "bg-sky-50 text-sky-700 dark:bg-sky-950/30 dark:text-sky-300",
      neutral:
        "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
    },
  },
  defaultVariants: {
    variant: "neutral",
  },
});

type AlertProps = {
  children: ReactNode;
  className?: string;
} & VariantProps<typeof alertVariants>;

export function Alert({ children, variant, className }: AlertProps) {
  return (
    <p className={cn(alertVariants({ variant }), className)}>{children}</p>
  );
}
