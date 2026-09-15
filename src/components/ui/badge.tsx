import type { ReactNode } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/ui/cn";

const badgeVariants = cva(
  "inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-semibold",
  {
    variants: {
      tone: {
        neutral:
          "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
        success:
          "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400",
        warning:
          "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400",
      },
    },
    defaultVariants: {
      tone: "neutral",
    },
  },
);

/**
 * A small status pill: "Current", "Unverified", "Not available yet".
 *
 * One copy of the pill, because hand-written ones had already begun to drift
 * in size and in their dark colours.
 */
export function Badge({
  children,
  tone,
  className,
}: {
  children: ReactNode;
  className?: string;
} & VariantProps<typeof badgeVariants>) {
  return (
    <span className={cn(badgeVariants({ tone }), className)}>{children}</span>
  );
}
