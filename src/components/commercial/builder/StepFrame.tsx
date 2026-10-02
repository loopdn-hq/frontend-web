import type { ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { Alert, Button } from "@/components/ui";

/**
 * One step of the builder: a card with the step's question, its fields, and
 * Back / continue at the bottom. A save failure that belongs to no one field
 * shows at the top.
 */
export function StepFrame({
  title,
  description,
  error,
  children,
  footer,
}: {
  title: string;
  description?: ReactNode;
  error?: string | null;
  children: ReactNode;
  footer: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6 dark:border-slate-800 dark:bg-slate-900">
      <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
        {title}
      </h2>
      {description && (
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          {description}
        </p>
      )}
      {error && (
        <Alert variant="error" className="mt-4">
          {error}
        </Alert>
      )}
      <div className="mt-5 space-y-6">{children}</div>
      <div className="mt-6 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-4 dark:border-slate-800">
        {footer}
      </div>
    </section>
  );
}

/** Back on the left, the step's main action on the right. */
export function StepFooter({
  onBack,
  primaryLabel,
  onPrimary,
  busy = false,
}: {
  onBack?: () => void;
  primaryLabel: string;
  onPrimary: () => void;
  busy?: boolean;
}) {
  return (
    <>
      {onBack ? (
        <Button variant="ghost" onClick={onBack} disabled={busy}>
          Back
        </Button>
      ) : (
        <span />
      )}
      <Button onClick={onPrimary} disabled={busy}>
        {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
        {primaryLabel}
      </Button>
    </>
  );
}
