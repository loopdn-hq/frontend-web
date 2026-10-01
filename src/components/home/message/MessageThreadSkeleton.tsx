"use client";

import { Skeleton, SkeletonRegion } from "@/components/ui/skeleton";

/**
 * The thread while its history is being fetched.
 *
 * Alternating sides, because that is what a conversation looks like and a
 * single column of grey blocks does not. Incoming rows carry an avatar and sit
 * left; your own sit right with none, mirroring MessageBubble, so the real
 * messages replace these in place.
 *
 * ONLY SHOWN WHEN THERE IS NOTHING CACHED for the conversation. Messages are
 * held in a Map keyed by conversation id, so re-opening one you have already
 * read paints instantly - and a skeleton that appears for eighty milliseconds
 * on every switch reads as a flicker, not as loading.
 *
 * Bottom-anchored like the real thread: a chat fills from the bottom up, so
 * blocks starting at the top would slide down the moment the messages arrive.
 */

const ROWS = [
  { mine: false, width: "w-48", lines: 2 },
  { mine: true, width: "w-56", lines: 1 },
  { mine: false, width: "w-40", lines: 1 },
  { mine: true, width: "w-64", lines: 2 },
  { mine: false, width: "w-52", lines: 1 },
] as const;

export function MessageThreadSkeleton() {
  return (
    <SkeletonRegion
      label="Loading messages"
      className="flex min-h-full flex-col justify-end gap-3"
    >
      {ROWS.map((row, index) => (
        <div
          key={index}
          className={`flex items-start gap-2 ${
            row.mine ? "justify-end" : "justify-start"
          }`}
        >
          {!row.mine && <Skeleton className="h-8 w-8 shrink-0 rounded-full" />}
          <div
            className={`rounded-[10px] px-3 py-2.5 ${
              row.mine ? "bg-tint" : "bg-bubble-in"
            }`}
          >
            <Skeleton className={`h-3 ${row.width}`} />
            {row.lines > 1 && (
              <Skeleton className={`mt-2 h-3 ${row.mine ? "w-32" : "w-28"}`} />
            )}
          </div>
        </div>
      ))}
    </SkeletonRegion>
  );
}
