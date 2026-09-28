"use client";

import type { ReactNode } from "react";

export type ChartTableRow = { label: string; value: string };

type ChartCardProps = {
  title: string;
  subtitle?: string;
  children: ReactNode;
  /**
   * The same numbers as the chart, as text.
   *
   * Not optional. A chart is a picture of the data and a picture is not
   * readable by everybody: hover is unavailable on touch, colour is
   * unavailable under CVD, and a screen reader gets nothing from an <svg> of
   * rectangles. The table is how every value stays reachable without any of
   * that, so no chart here ships without one.
   */
  table: { valueHeading: string; rows: ChartTableRow[] };
};

/** The frame every chart on this page shares: heading, plot, data table. */
export function ChartCard({
  title,
  subtitle,
  children,
  table,
}: ChartCardProps) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
        {title}
      </h3>
      {subtitle && (
        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
          {subtitle}
        </p>
      )}

      <div className="mt-4">{children}</div>

      <details className="group mt-3">
        <summary className="cursor-pointer text-2xs font-semibold text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200">
          Show data table
        </summary>
        <table className="mt-2 w-full text-left text-xs">
          <caption className="sr-only">{title}</caption>
          <thead>
            <tr className="text-slate-500 dark:text-slate-400">
              <th scope="col" className="py-1 font-medium">
                Series
              </th>
              <th scope="col" className="py-1 text-right font-medium">
                {table.valueHeading}
              </th>
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row) => (
              <tr
                key={row.label}
                className="border-t border-slate-100 dark:border-slate-800"
              >
                <th
                  scope="row"
                  className="py-1 font-normal text-slate-700 dark:text-slate-300"
                >
                  {row.label}
                </th>
                <td className="py-1 text-right text-slate-900 tabular-nums dark:text-slate-100">
                  {row.value}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </article>
  );
}

/**
 * The hover/focus readout. Value first, name second - the reader already knows
 * which mark they are pointing at and wants the number.
 */
export function ChartTooltip({
  label,
  value,
  tone,
  className = "",
}: {
  label: string;
  value: string;
  tone: SeriesTone;
  className?: string;
}) {
  return (
    <div
      role="tooltip"
      className={`pointer-events-none absolute z-10 w-max max-w-[12rem] rounded-lg bg-slate-900 px-2 py-1.5 text-left shadow-lg dark:bg-slate-700 ${className}`}
    >
      <p className="flex items-center gap-1.5 text-xs font-semibold text-white tabular-nums">
        {/* A short stroke of the series colour, not a filled box: at tooltip
            density a box is data-weight ink doing a label's job. */}
        <span
          aria-hidden
          className="h-0.5 w-3 shrink-0 rounded-full"
          style={{ backgroundColor: seriesColor(tone) }}
        />
        {value}
      </p>
      <p className="text-3xs text-slate-300">{label}</p>
    </div>
  );
}

/**
 * Categorical slots 1 and 2 of the validated palette, as CSS variables so the
 * dark steps are chosen rather than an automatic flip of the light ones. See
 * globals.css.
 */
export type SeriesTone = "series-1" | "series-2";

export function seriesColor(tone: SeriesTone): string {
  return `var(--viz-${tone})`;
}

/**
 * Whole-number percentages that add up to 100.
 *
 * Rounding each share on its own does not: 3 and 5 out of 8 are 37.5% and
 * 62.5%, which round to 38% and 63% and put 101% on the screen. A legend that
 * does not add up reads as a bug in the number, not in the rounding.
 *
 * Largest remainder: everybody gets their floor, and the points left over go
 * to whoever was cut by the most.
 */
export function wholePercentages(values: number[]): number[] {
  const total = values.reduce((sum, value) => sum + value, 0);
  if (total <= 0) return values.map(() => 0);

  const exact = values.map((value) => (value / total) * 100);
  const shares = exact.map(Math.floor);
  const ranked = exact
    .map((value, index) => ({ index, remainder: value - Math.floor(value) }))
    .sort((a, b) => b.remainder - a.remainder);

  let left = 100 - shares.reduce((sum, share) => sum + share, 0);
  for (const { index } of ranked) {
    if (left <= 0) break;
    shares[index] += 1;
    left -= 1;
  }
  return shares;
}

/** 0 -> 0, 3 -> 5, 12.5 -> 20: a clean axis top the ticks can divide. */
export function niceCeiling(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const normalized = value / magnitude;
  const step =
    normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return step * magnitude;
}
