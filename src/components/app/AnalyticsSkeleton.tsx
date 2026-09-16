"use client";

import { Skeleton, SkeletonRegion } from "@/components/ui/skeleton";

/**
 * The analytics screen while its figures are being fetched.
 *
 * Numbers are the one thing a skeleton must be careful with: a grey block where
 * a figure will be reads as "loading", but a ZERO rendered early reads as a
 * fact. That is why this replaces the whole screen rather than letting empty
 * cards paint first and fill in afterwards.
 *
 * The 4-up grid and the section cards mirror the real layout at every
 * breakpoint, so the page does not reflow when the data lands.
 */

const TILE_ROWS = 2;

function Tile() {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
      <Skeleton className="h-2.5 w-16" />
      <Skeleton className="mt-2.5 h-5 w-20" />
    </article>
  );
}

export function AnalyticsSkeleton() {
  return (
    <SkeletonRegion label="Loading analytics">
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, tile) => (
          <Tile key={tile} />
        ))}
      </section>

      {Array.from({ length: TILE_ROWS }, (_, section) => (
        <section
          key={section}
          className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
        >
          <Skeleton className="h-4 w-40" />
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }, (_, tile) => (
              <Tile key={tile} />
            ))}
          </div>
        </section>
      ))}
    </SkeletonRegion>
  );
}
