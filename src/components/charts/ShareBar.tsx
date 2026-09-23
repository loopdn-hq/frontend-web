"use client";

import { useState } from "react";
import {
  ChartCard,
  ChartTooltip,
  seriesColor,
  wholePercentages,
  type SeriesTone,
} from "@/components/charts/ChartCard";

export type ShareSegment = {
  label: string;
  value: number;
  tone: SeriesTone;
};

type ShareBarProps = {
  title: string;
  /** What one unit is: "groups", "messages". Used in the subtitle and table. */
  unit: string;
  segments: ShareSegment[];
  emptyMessage: string;
};

/**
 * Part-to-whole, as a horizontal stacked bar.
 *
 * The flatter of the two share forms, and the one to reach for when a split is
 * being shown ALONGSIDE another: length against a common baseline is an easier
 * comparison than angle, it survives a third and fourth part, and several of
 * these stacked down a column can be read against each other in a way that a
 * row of rings cannot. DonutChart is the other one - a ring buys a middle to
 * put the total in, which is worth it for the split a section leads with.
 *
 * Every value is in the legend as well as the bar, so nothing is behind a
 * hover, and the segments are never labelled inline - at these widths the
 * text would be clipped by its own mark.
 */
export function ShareBar({
  title,
  unit,
  segments,
  emptyMessage,
}: ShareBarProps) {
  const [active, setActive] = useState<number | null>(null);

  const total = segments.reduce((sum, segment) => sum + segment.value, 0);
  const shares = wholePercentages(segments.map((segment) => segment.value));
  const table = {
    valueHeading: "Count",
    rows: [
      ...segments.map((segment, index) => ({
        label: segment.label,
        value: `${segment.value} (${shares[index]}%)`,
      })),
      { label: "Total", value: String(total) },
    ],
  };

  if (total === 0) {
    return (
      <ChartCard title={title} table={table}>
        <p className="py-6 text-center text-xs text-slate-500 dark:text-slate-400">
          {emptyMessage}
        </p>
      </ChartCard>
    );
  }

  // Zero-value parts are dropped rather than drawn: a 0% segment is either
  // invisible or, once it has a minimum width, a lie about the data.
  const drawn = segments
    .map((segment, index) => ({ ...segment, index }))
    .filter((segment) => segment.value > 0);

  return (
    <ChartCard
      title={title}
      subtitle={`${total} ${unit} in total`}
      table={table}
    >
      <div className="relative">
        {/* The gap between segments is the card's own background showing
            through - 2px of surface, not a border drawn around each fill. */}
        <div className="flex h-6 w-full gap-[2px] overflow-hidden rounded [&>*:first-child]:rounded-l [&>*:last-child]:rounded-r">
          {drawn.map((segment) => (
            <div
              key={segment.label}
              role="img"
              tabIndex={0}
              aria-label={`${segment.label}: ${segment.value} of ${total} ${unit}`}
              onPointerEnter={() => setActive(segment.index)}
              onPointerLeave={() => setActive(null)}
              onFocus={() => setActive(segment.index)}
              onBlur={() => setActive(null)}
              style={{
                width: `${(segment.value / total) * 100}%`,
                backgroundColor: seriesColor(segment.tone),
                opacity: active === null || active === segment.index ? 1 : 0.75,
              }}
              className="h-full transition-opacity focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500"
            />
          ))}
        </div>

        {active !== null && segments[active] && (
          <ChartTooltip
            label={segments[active].label}
            value={`${segments[active].value} of ${total}`}
            tone={segments[active].tone}
            className="bottom-full left-0 mb-2"
          />
        )}
      </div>

      {/* A legend is the dependable identity channel, and carrying the value
          here is what keeps it off the segments. */}
      <ul className="mt-3 space-y-1.5">
        {segments.map((segment, index) => (
          <li
            key={segment.label}
            className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300"
          >
            <span
              aria-hidden
              className="h-2.5 w-2.5 shrink-0 rounded-sm"
              style={{ backgroundColor: seriesColor(segment.tone) }}
            />
            <span className="min-w-0 flex-1 truncate">{segment.label}</span>
            <span className="shrink-0 font-semibold text-slate-900 tabular-nums dark:text-slate-100">
              {segment.value}
            </span>
            <span className="w-10 shrink-0 text-right text-slate-500 tabular-nums dark:text-slate-400">
              {shares[index]}%
            </span>
          </li>
        ))}
      </ul>
    </ChartCard>
  );
}
