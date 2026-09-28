import type { ReactNode } from "react";

/**
 * A section of the skeleton that has a place but no implementation.
 *
 * Says so plainly, and says what will go here and which endpoint it waits on,
 * rather than mocking numbers: a dashboard showing invented spend is worse
 * than one showing none. Delete each one as its section is built.
 */
export function NotBuiltYet({
  title,
  children,
  endpoint,
}: {
  title: string;
  /** What this section will do, in a sentence or a short list. */
  children: ReactNode;
  /** The API route it depends on, e.g. "GET /promote/campaigns/{id}/report/". */
  endpoint?: string;
}) {
  return (
    <section className="rounded-2xl border border-dashed border-slate-300 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
      <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
        {title}
      </h2>
      <div className="mt-1.5 text-sm text-slate-600 dark:text-slate-400">
        {children}
      </div>
      {endpoint && (
        <p className="mt-3 font-mono text-xs text-slate-500 dark:text-slate-500">
          Needs {endpoint}
        </p>
      )}
      <p className="mt-3 text-xs font-medium text-amber-700 dark:text-amber-400">
        Not built yet.
      </p>
    </section>
  );
}
