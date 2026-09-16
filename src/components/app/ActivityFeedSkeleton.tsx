"use client";

import { Skeleton, SkeletonRegion } from "@/components/ui/skeleton";

/**
 * The activity list while its first page is being fetched.
 *
 * Geometry copied from ActivityRow - the same rounded-xl border, p-3, gap-3 and
 * 36px icon circle - so the real rows land where the grey ones were.
 *
 * The bucket heading ("Today", "Earlier") is drawn as a block too. It is part of
 * the list's rhythm, and leaving it out would let every row shift up by a line
 * the moment the real data arrives.
 */

const BUCKETS = [
  { rows: 3, width: "w-16" },
  { rows: 2, width: "w-20" },
] as const;

// Varied so the column does not read as a printed form. Fixed, never random:
// this is a static export, and random widths would differ between the server
// and the client render.
const LINES = [
  ["w-44", "w-32"],
  ["w-36", "w-40"],
  ["w-48", "w-28"],
] as const;

export function ActivityFeedSkeleton() {
  return (
    <SkeletonRegion label="Loading your activity">
      {BUCKETS.map((bucket, index) => (
        <div key={index} className="mb-4">
          <Skeleton className={`mb-2 ml-1 h-2.5 ${bucket.width}`} />
          <div className="space-y-2">
            {Array.from({ length: bucket.rows }, (_, row) => {
              const [title, body] = LINES[row % LINES.length];
              return (
                <div
                  key={row}
                  className="flex w-full items-start gap-3 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900"
                >
                  <Skeleton className="h-9 w-9 shrink-0 rounded-full" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <Skeleton className={`h-3.5 ${title}`} />
                      <Skeleton className="h-2.5 w-8 shrink-0" />
                    </div>
                    <Skeleton className={`mt-2 h-3 ${body}`} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </SkeletonRegion>
  );
}
