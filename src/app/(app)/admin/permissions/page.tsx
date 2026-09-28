"use client";

/**
 * What each role may use, and changing it.
 *
 * Answers "what can a commercial user actually do?" without anybody reading the
 * database, and lets an account admin change the answer.
 *
 * Reading and writing are separate features on the server -
 * `platform.permissions.view` and `platform.permissions.edit` - so a support
 * role can be given the first without the second. This page renders read-only
 * when it only has the first.
 *
 * NOTHING HERE IS THE GUARD. The server refuses a locked feature leaving
 * `admin`, refuses one being handed below `admin`, and writes an audit row for
 * every change. A signed-in non-admin opening this URL directly gets a 403.
 * The UI only decides what to show and what to grey out.
 */
import { Fragment, useCallback, useEffect, useState } from "react";
import { Check, Loader2, Lock, Minus } from "lucide-react";

import { NavDrawerButton } from "@/components/app/NavDrawerButton";
import {
  fetchPermissionsMatrix,
  setGrant,
  useFeatures,
  type Grant,
  type MatrixAxis,
  type PermissionsMatrix,
} from "@/lib/rbac";

function GrantMark({ grant, locked }: { grant: Grant; locked: boolean }) {
  // Locked wins over the grant: "cannot be allowed here" is a different fact
  // from "is not allowed", and a reader should not have to know which
  // features are lockable to tell them apart.
  if (locked && grant !== true) {
    return (
      <span
        className="inline-flex items-center justify-center text-slate-300 dark:text-slate-700"
        title="Never grantable below account admin"
      >
        <Lock className="h-3.5 w-3.5" />
      </span>
    );
  }

  if (grant === true) {
    return (
      <span className="inline-flex items-center justify-center text-emerald-600 dark:text-emerald-400">
        <Check className="h-4 w-4" />
      </span>
    );
  }

  if (grant === false) {
    return (
      <span className="inline-flex items-center justify-center text-slate-300 dark:text-slate-700">
        <Minus className="h-4 w-4" />
      </span>
    );
  }

  // No cell at all. Denies like `false`, but nobody wrote it down - the server
  // raises rbac.W002 for exactly this, so it must not look like a decision.
  return (
    <span
      className="text-xs font-medium text-amber-600 dark:text-amber-500"
      title="No grant recorded. Denies, but nobody set it."
    >
      ?
    </span>
  );
}

function GrantCell({
  grant,
  locked,
  editable,
  busy,
  onToggle,
}: {
  grant: Grant;
  locked: boolean;
  editable: boolean;
  busy: boolean;
  onToggle: () => void;
}) {
  // Locked cells are never buttons, even for an admin who could technically
  // POST one. The server refuses it; offering the click would be a lie.
  if (!editable || locked) {
    return <GrantMark grant={grant} locked={locked} />;
  }

  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={busy}
      aria-pressed={grant === true}
      className="inline-flex h-7 w-7 items-center justify-center rounded-lg transition hover:bg-slate-100 disabled:opacity-40 dark:hover:bg-slate-800"
      title={grant === true ? "Allowed — click to deny" : "Click to allow"}
    >
      <GrantMark grant={grant} locked={locked} />
    </button>
  );
}

function AxisTable({
  axis,
  editable,
  busyCell,
  onToggle,
}: {
  axis: MatrixAxis;
  editable: boolean;
  busyCell: string | null;
  onToggle: (feature: string, role: string, next: boolean) => void;
}) {
  return (
    <section className="mb-8">
      <h2 className="mb-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
        {axis.label}
      </h2>
      <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
        {axis.axis === "account"
          ? "Which areas of the product a person can reach at all."
          : "What a person can do inside one conversation."}
      </p>

      {/* Tables are the one thing allowed to be wider than the page. */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
        <table className="w-full min-w-[32rem] border-collapse text-sm">
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-900">
              <th className="px-4 py-2.5 text-left font-medium text-slate-600 dark:text-slate-400">
                Feature
              </th>
              {axis.roles.map((role) => (
                <th
                  key={role}
                  className="w-24 px-2 py-2.5 text-center font-medium text-slate-600 dark:text-slate-400"
                >
                  {role}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {axis.areas.map((area) => (
              // Fragment, not <>, because the shorthand cannot carry a key and
              // a table row group has to stay siblings inside <tbody>.
              <Fragment key={`${axis.axis}-${area.area}`}>
                <tr>
                  <td
                    colSpan={axis.roles.length + 1}
                    className="border-t border-slate-200 bg-slate-50/60 px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-400"
                  >
                    {area.area}
                  </td>
                </tr>
                {area.features.map((feature) => (
                  <tr
                    key={feature.key}
                    className="border-t border-slate-100 dark:border-slate-800/60"
                  >
                    <td className="px-4 py-2">
                      <div className="text-slate-900 dark:text-slate-100">
                        {feature.label}
                      </div>
                      <div className="font-mono text-[11px] text-slate-400 dark:text-slate-500">
                        {feature.key}
                      </div>
                    </td>
                    {axis.roles.map((role) => {
                      const grant = feature.grants[role] ?? null;
                      return (
                        <td key={role} className="px-2 py-2 text-center">
                          <GrantCell
                            grant={grant}
                            locked={feature.locked}
                            editable={editable}
                            busy={busyCell === `${feature.key}:${role}`}
                            // A null cell has never been written, so the first
                            // click allows it - which is what somebody
                            // clicking an unset cell means.
                            onToggle={() =>
                              onToggle(feature.key, role, grant !== true)
                            }
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default function PermissionsPage() {
  const [matrix, setMatrix] = useState<PermissionsMatrix | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  // Which cell is mid-flight, as "feature:role". One at a time: the server
  // takes one cell per call, so two clicks race and the second would render
  // against a matrix that already moved.
  const [busyCell, setBusyCell] = useState<string | null>(null);
  // Refused edits - a locked feature, the last-admin guard - arrive as a
  // sentence worth showing, separately from a failure to load at all.
  const [refusal, setRefusal] = useState<string | null>(null);

  const { features, loading: featuresLoading } = useFeatures();
  const editable =
    !featuresLoading && features.has("platform.permissions.edit");

  useEffect(() => {
    let cancelled = false;

    fetchPermissionsMatrix().then((result) => {
      if (cancelled) return;
      setIsLoading(false);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setError(null);
      setMatrix(result.matrix);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const handleToggle = useCallback(
    (feature: string, role: string, next: boolean) => {
      setBusyCell(`${feature}:${role}`);
      setRefusal(null);

      setGrant({ feature, role, allowed: next }).then((result) => {
        setBusyCell(null);
        if (!result.ok) {
          setRefusal(result.message);
          return;
        }
        // The server hands back the whole matrix rather than the cell, so the
        // screen never has to work out what a change implied.
        setMatrix(result.matrix);
      });
    },
    [],
  );

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-slate-50 dark:bg-slate-950">
      <header className="border-b border-slate-200 px-4 py-4 dark:border-slate-800">
        <div className="flex min-w-0 items-center gap-1">
          <NavDrawerButton className="-ml-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300" />
          <div className="min-w-0">
            <h1 className="truncate text-xl font-bold text-slate-900 dark:text-slate-100">
              Permissions
            </h1>
            <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">
              {editable
                ? "What each role can use. Click a cell to change it."
                : "What each role can use. Read-only."}
            </p>
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-5xl p-4 sm:p-6">
        {isLoading && (
          <p className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading permissions…
          </p>
        )}

        {!isLoading && error && (
          <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:bg-rose-950 dark:text-rose-300">
            {error}
          </p>
        )}

        {refusal && (
          <p className="mb-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:bg-amber-950 dark:text-amber-200">
            {refusal}
          </p>
        )}

        {!isLoading && !error && matrix && (
          <>
            <dl className="mb-6 flex flex-wrap gap-x-6 gap-y-2 text-xs text-slate-500 dark:text-slate-400">
              <div className="flex items-center gap-1.5">
                <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                <dd>Allowed</dd>
              </div>
              <div className="flex items-center gap-1.5">
                <Minus className="h-3.5 w-3.5" />
                <dd>Not allowed</dd>
              </div>
              <div className="flex items-center gap-1.5">
                <Lock className="h-3.5 w-3.5" />
                <dd>Never grantable below account admin</dd>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="font-medium text-amber-600 dark:text-amber-500">
                  ?
                </span>
                <dd>No grant recorded — denies, but nobody set it</dd>
              </div>
            </dl>

            {matrix.axes.map((axis) => (
              <AxisTable
                key={axis.axis}
                axis={axis}
                editable={editable}
                busyCell={busyCell}
                onToggle={handleToggle}
              />
            ))}
          </>
        )}
      </div>
    </div>
  );
}
