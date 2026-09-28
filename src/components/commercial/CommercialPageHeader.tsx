import type { ReactNode } from "react";

/** The title row every commercial page starts with. */
export function CommercialPageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  /** Buttons on the right, e.g. "New campaign". */
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 px-4 py-4 sm:px-6 dark:border-slate-800">
      <div className="min-w-0">
        <h1 className="truncate text-xl font-bold text-slate-900 dark:text-slate-100">
          {title}
        </h1>
        {description && (
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
            {description}
          </p>
        )}
      </div>
      {actions && <div className="flex shrink-0 gap-2">{actions}</div>}
    </header>
  );
}
