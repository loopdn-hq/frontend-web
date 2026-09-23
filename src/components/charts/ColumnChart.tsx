"use client";

import { useState } from "react";
import {
  ChartCard,
  ChartTooltip,
  niceCeiling,
  seriesColor,
  type SeriesTone,
} from "@/components/charts/ChartCard";

export type ColumnDatum = {
  label: string;
  /** The number the bar's height is drawn from. */
  value: number;
  /** That number as the reader should see it: "$12.00", "4.5". */
  display: string;
  tone: SeriesTone;
};

type ColumnChartProps = {
  title: string;
  subtitle?: string;
  data: ColumnDatum[];
  /** Axis ticks, in the same unit as `value`. Defaults to a plain number. */
  formatTick?: (value: number) => string;
  emptyMessage: string;
};

/**
 * Magnitude, as columns from a single baseline.
 *
 * Two measures are never given two y-scales - one axis, so the heights are
 * comparable. Where the two bars are the same measure (average against
 * largest) they share one hue and the chart has no legend, because there is
 * only one thing being measured and the title says what it is.
 */
export function ColumnChart({
  title,
  subtitle,
  data,
  formatTick = (value) => value.toLocaleString(),
  emptyMessage,
}: ColumnChartProps) {
  const [active, setActive] = useState<number | null>(null);

  const table = {
    valueHeading: "Value",
    rows: data.map((datum) => ({ label: datum.label, value: datum.display })),
  };

  const top = niceCeiling(Math.max(...data.map((datum) => datum.value), 0));

  if (top === 0) {
    return (
      <ChartCard title={title} subtitle={subtitle} table={table}>
        <p className="py-6 text-center text-xs text-slate-500 dark:text-slate-400">
          {emptyMessage}
        </p>
      </ChartCard>
    );
  }

  const ticks = [top, top / 2, 0];
  // Two bars of the same colour are one series, so they need no legend.
  const tones = new Set(data.map((datum) => datum.tone));

  return (
    <ChartCard title={title} subtitle={subtitle} table={table}>
      {/* pt-5 on both columns reserves a band above the plot for the cap
          labels. Without it the tallest bar plus its label is taller than the
          box and, as a flex child, the BAR is what shrinks - so the mark the
          reader compares everything against would be drawn short. The bars are
          positioned against this inner box, and the tick labels share its top
          offset so each still sits on its own gridline. */}
      <div className="flex gap-2">
        <div className="flex h-40 w-14 shrink-0 flex-col justify-between pt-5 text-right text-3xs text-slate-400 tabular-nums dark:text-slate-500">
          {ticks.map((tick) => (
            // Nudged up by half a line so the text centres on the gridline.
            <span key={tick} className="-translate-y-[0.4em]">
              {formatTick(tick)}
            </span>
          ))}
        </div>

        <div className="h-40 min-w-0 flex-1 pt-5">
          <div className="relative h-full">
            {/* Hairline, solid, one step off the surface: present enough to
                read a value against, recessive enough to stay behind. */}
            <div aria-hidden className="absolute inset-0">
              {ticks.map((tick) => (
                <div
                  key={tick}
                  className="absolute right-0 left-0 h-px bg-[var(--viz-grid)]"
                  style={{ bottom: `${(tick / top) * 100}%` }}
                />
              ))}
            </div>

            <div className="absolute inset-0 flex items-end justify-around">
              {data.map((datum, index) => {
                const height = (datum.value / top) * 100;
                return (
                  <div
                    key={datum.label}
                    role="img"
                    tabIndex={0}
                    aria-label={`${datum.label}: ${datum.display}`}
                    onPointerEnter={() => setActive(index)}
                    onPointerLeave={() => setActive(null)}
                    onFocus={() => setActive(index)}
                    onBlur={() => setActive(null)}
                    // The hit target is the whole column, not the painted bar.
                    className="relative h-full min-w-0 flex-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500"
                  >
                    {active === index && (
                      <ChartTooltip
                        label={datum.label}
                        value={datum.display}
                        tone={datum.tone}
                        className="bottom-full left-1/2 mb-1 -translate-x-1/2"
                      />
                    )}
                    <div
                      // Rounded at the data-end, square on the baseline.
                      className="absolute bottom-0 left-1/2 w-6 -translate-x-1/2 rounded-t transition-opacity"
                      style={{
                        height: `${height}%`,
                        backgroundColor: seriesColor(datum.tone),
                        opacity: active === null || active === index ? 1 : 0.75,
                      }}
                    />
                    {/* The value on the cap: the one direct label this chart
                        needs, which is why three ticks are enough. */}
                    <span
                      className="absolute left-1/2 -translate-x-1/2 text-2xs font-semibold text-slate-700 tabular-nums dark:text-slate-200"
                      style={{ bottom: `calc(${height}% + 2px)` }}
                    >
                      {datum.display}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-2 flex gap-2 pl-16">
        {data.map((datum) => (
          <span
            key={datum.label}
            className="min-w-0 flex-1 truncate text-center text-2xs text-slate-500 dark:text-slate-400"
          >
            {datum.label}
          </span>
        ))}
      </div>

      {tones.size > 1 && (
        <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
          {data.map((datum) => (
            <li
              key={datum.label}
              className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300"
            >
              <span
                aria-hidden
                className="h-2.5 w-2.5 shrink-0 rounded-sm"
                style={{ backgroundColor: seriesColor(datum.tone) }}
              />
              {datum.label}
            </li>
          ))}
        </ul>
      )}
    </ChartCard>
  );
}
