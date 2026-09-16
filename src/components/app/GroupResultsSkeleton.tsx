"use client";

import { Skeleton, SkeletonRegion } from "@/components/ui/skeleton";

/**
 * Search results on Find groups, while the search is in flight.
 *
 * A CARD GRID rather than a list, because that is what the results are - and
 * the same breakpoints, so the number of columns never changes underneath the
 * reader when the real cards arrive.
 *
 * Four cards, not a screenful: this replaces a search result, and promising a
 * full grid when two groups matched would be a bigger lie than a short one.
 */

const CARDS = 4;

export function GroupResultsSkeleton() {
  return (
    <SkeletonRegion
      label="Searching for groups"
      className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
    >
      {Array.from({ length: CARDS }, (_, card) => (
        <div
          key={card}
          className="flex flex-col rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
        >
          <div className="flex items-start justify-between gap-3">
            <Skeleton className="h-12 w-12 shrink-0 rounded-full" />
            <Skeleton className="h-4 w-14 rounded-full" />
          </div>
          <Skeleton className="mt-3 h-4 w-32" />
          <Skeleton className="mt-2.5 h-3 w-full" />
          <Skeleton className="mt-1.5 h-3 w-4/5" />
          <Skeleton className="mt-3 h-3 w-24" />
          {/* The join button. Its height is why the card does not resize. */}
          <Skeleton className="mt-4 h-10 w-full rounded-xl" />
        </div>
      ))}
    </SkeletonRegion>
  );
}
