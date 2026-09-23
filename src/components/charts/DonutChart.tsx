"use client";

import { useState } from "react";
import {
  ChartCard,
  ChartTooltip,
  seriesColor,
  wholePercentages,
  type SeriesTone,
} from "@/components/charts/ChartCard";

export type DonutSlice = {
  label: string;
  value: number;
  tone: SeriesTone;
};

type DonutChartProps = {
  title: string;
  subtitle?: string;
  /** What one unit is: "groups". Shown under the total in the middle. */
  unit: string;
  slices: DonutSlice[];
  emptyMessage: string;
};

// Geometry of the ring. A donut rather than a full pie: the hole is where the
// total goes, and the total is the number a share chart is always asked for.
const SIZE = 168;
const RADIUS = 66;
const THICKNESS = 20;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
/** The surface gap, as arc length - the same 2px used between stacked fills. */
const GAP = 2;

/**
 * Part-to-whole, as a ring.
 *
 * Angles are a harder comparison than lengths, so the ring is not asked to
 * carry the reading on its own: every slice's value and percentage is in the
 * legend, the total is in the middle, and the table underneath has all of it
 * as text. The ring shows the shape of the split; the numbers beside it are
 * what people actually read off.
 *
 * Slices worth less than a whole percent still get a hairline of arc so they
 * are visible, and a slice worth nothing is dropped entirely.
 */
export function DonutChart({
  title,
  subtitle,
  unit,
  slices,
  emptyMessage,
}: DonutChartProps) {
  const [active, setActive] = useState<number | null>(null);

  const total = slices.reduce((sum, slice) => sum + slice.value, 0);
  const shares = wholePercentages(slices.map((slice) => slice.value));
  const table = {
    valueHeading: "Count",
    rows: [
      ...slices.map((slice, index) => ({
        label: slice.label,
        value:
          total > 0
            ? `${slice.value} (${shares[index]}%)`
            : String(slice.value),
      })),
      { label: "Total", value: String(total) },
    ],
  };

  if (total === 0) {
    return (
      <ChartCard title={title} subtitle={subtitle} table={table}>
        <p className="py-6 text-center text-xs text-slate-500 dark:text-slate-400">
          {emptyMessage}
        </p>
      </ChartCard>
    );
  }

  // A slice worth nothing is dropped: a 0% arc is either invisible or, once it
  // has a minimum length, a lie about the data.
  const drawn = slices
    .map((slice, index) => ({ ...slice, index }))
    .filter((slice) => slice.value > 0);

  // Each arc starts where everything before it ended. Summed per slice rather
  // than carried in a running total, because a variable mutated while
  // rendering is exactly what React 19 will not have - and with a handful of
  // slices the repeated sum costs nothing.
  const arcs = drawn.map((slice, position) => {
    const before = drawn
      .slice(0, position)
      .reduce((sum, earlier) => sum + earlier.value, 0);
    const length = (slice.value / total) * CIRCUMFERENCE;
    return {
      ...slice,
      offset: (before / total) * CIRCUMFERENCE,
      // Never shorter than the gap it has to survive, or a thin slice
      // disappears into its own spacing.
      length: Math.max(length - GAP, GAP),
    };
  });

  return (
    <ChartCard title={title} subtitle={subtitle} table={table}>
      <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center sm:gap-5">
        <div className="relative shrink-0">
          <svg
            viewBox={`0 0 ${SIZE} ${SIZE}`}
            className="h-[168px] w-[168px]"
            role="img"
            aria-label={`${title}: ${arcs
              .map((arc) => `${arc.label} ${arc.value} of ${total}`)
              .join(", ")}`}
          >
            {/* -90deg so the first slice starts at twelve o'clock, which is
                where a reader's eye enters a ring. */}
            <g transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}>
              {arcs.map((arc) => (
                <circle
                  key={arc.label}
                  cx={SIZE / 2}
                  cy={SIZE / 2}
                  r={RADIUS}
                  fill="none"
                  stroke={seriesColor(arc.tone)}
                  strokeWidth={THICKNESS}
                  strokeDasharray={`${arc.length} ${CIRCUMFERENCE - arc.length}`}
                  strokeDashoffset={-arc.offset}
                  tabIndex={0}
                  role="img"
                  aria-label={`${arc.label}: ${arc.value} of ${total} ${unit}`}
                  onPointerEnter={() => setActive(arc.index)}
                  onPointerLeave={() => setActive(null)}
                  onFocus={() => setActive(arc.index)}
                  onBlur={() => setActive(null)}
                  className="cursor-default transition-opacity focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500"
                  style={{
                    opacity: active === null || active === arc.index ? 1 : 0.75,
                  }}
                />
              ))}
            </g>
          </svg>

          {/* The hole earns its keep: the total, once, in the middle. */}
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-bold text-slate-900 tabular-nums dark:text-slate-100">
              {total}
            </span>
            <span className="text-2xs text-slate-500 dark:text-slate-400">
              {unit}
            </span>
          </div>

          {active !== null && slices[active] && (
            <ChartTooltip
              label={slices[active].label}
              value={`${slices[active].value} of ${total}`}
              tone={slices[active].tone}
              className="top-0 left-1/2 -translate-x-1/2"
            />
          )}
        </div>

        {/* The legend is the identity channel, and carrying the numbers here is
            what keeps them off the ring, where they would need leader lines. */}
        <ul className="w-full min-w-0 space-y-1.5">
          {slices.map((slice, index) => (
            <li
              key={slice.label}
              className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300"
            >
              <span
                aria-hidden
                className="h-2.5 w-2.5 shrink-0 rounded-sm"
                style={{ backgroundColor: seriesColor(slice.tone) }}
              />
              <span className="min-w-0 flex-1 truncate">{slice.label}</span>
              <span className="shrink-0 font-semibold text-slate-900 tabular-nums dark:text-slate-100">
                {slice.value}
              </span>
              <span className="w-10 shrink-0 text-right text-slate-500 tabular-nums dark:text-slate-400">
                {shares[index]}%
              </span>
            </li>
          ))}
        </ul>
      </div>
    </ChartCard>
  );
}
