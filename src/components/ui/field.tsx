import type { ReactNode } from "react";
import { cn } from "@/lib/ui/cn";

type FieldProps = {
  label?: ReactNode;
  htmlFor?: string;
  hint?: ReactNode;
  error?: ReactNode;
  className?: string;
  children: ReactNode;
};

export function Field({
  label,
  htmlFor,
  hint,
  error,
  className,
  children,
}: FieldProps) {
  return (
    <div className={cn("space-y-1.5", className)}>
      {label && (
        <label
          htmlFor={htmlFor}
          className="block text-sm font-semibold text-slate-900 dark:text-slate-100"
        >
          {label}
        </label>
      )}
      {children}
      {hint && (
        <p className="text-xs text-slate-500 dark:text-slate-400">{hint}</p>
      )}
      {error && <p className="text-xs text-rose-600">{error}</p>}
    </div>
  );
}
