import type { ReportDay } from "@/lib/commercial/types";

/**
 * Views by day, as plain bars: the `days` calendar days up to the last one
 * with results, oldest on the left, a day without views drawn as a sliver.
 * A sentence underneath for screen readers, since the bars alone say nothing
 * to them.
 */
export function DailyBars({
  rows,
  days = 14,
}: {
  rows: ReportDay[];
  days?: number;
}) {
  if (rows.length === 0) return null;
  const viewed = new Map(rows.map((row) => [row.day, row.viewed]));
  const shown = calendar(rows[rows.length - 1].day, days).map((day) => ({
    day,
    viewed: viewed.get(day) ?? 0,
  }));
  const most = Math.max(1, ...shown.map((row) => row.viewed));
  const withViews = shown.filter((row) => row.viewed > 0);

  return (
    <figure>
      <div className="flex h-24 items-end gap-0.5 sm:gap-1" aria-hidden>
        {shown.map((row) => (
          <div
            key={row.day}
            title={`${shortDay(row.day)}: ${row.viewed.toLocaleString()} views`}
            className={
              row.viewed > 0
                ? "min-w-0 flex-1 rounded-t bg-sky-500/80 dark:bg-sky-400/70"
                : "min-w-0 flex-1 rounded-t bg-slate-200 dark:bg-slate-800"
            }
            style={{
              height:
                row.viewed > 0
                  ? `${Math.max(6, (row.viewed / most) * 100)}%`
                  : "2px",
            }}
          />
        ))}
      </div>
      <div className="mt-1 flex justify-between text-2xs text-slate-500 dark:text-slate-400">
        <span>{shortDay(shown[0].day)}</span>
        <span>{shortDay(shown[shown.length - 1].day)}</span>
      </div>
      <figcaption className="sr-only">
        Views by day:{" "}
        {withViews.length === 0
          ? "none yet"
          : withViews
              .map((row) => `${shortDay(row.day)} ${row.viewed} views`)
              .join(", ")}
      </figcaption>
    </figure>
  );
}

/** The `count` days ending on `last` ("2026-10-03"), oldest first. */
function calendar(last: string, count: number): string[] {
  const end = new Date(`${last}T00:00:00Z`);
  if (Number.isNaN(end.getTime())) return [last];
  return Array.from({ length: count }, (_, index) => {
    const day = new Date(end);
    day.setUTCDate(end.getUTCDate() - (count - 1 - index));
    return day.toISOString().slice(0, 10);
  });
}

function shortDay(day: string): string {
  const date = new Date(`${day}T00:00:00Z`);
  return Number.isNaN(date.getTime())
    ? day
    : date.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        timeZone: "UTC",
      });
}
