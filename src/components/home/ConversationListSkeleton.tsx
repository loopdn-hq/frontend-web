"use client";

import { Skeleton, SkeletonRegion } from "@/components/ui/skeleton";

/**
 * The chat list while it is still being fetched.
 *
 * This replaces a REAL BUG rather than filling dead air. The list starts empty
 * and is populated by an effect, so until this existed the first paint rendered
 * the "No chats yet - Create a loop to get started" empty state and then
 * replaced it with a full list a moment later. Telling somebody they have
 * nothing and then contradicting it is worse than showing nothing at all.
 *
 * The row geometry is copied from renderConversationButton - same rounded-xl,
 * same px-3 py-2.5, same 40px avatar, same gap-3 - so the real rows land
 * exactly where the grey ones were and the list does not jump.
 *
 * Widths are a fixed cycle, never random: this app is a static export, and
 * Math.random() here would render different markup on the server and the
 * client. It also keeps the shape stable across re-renders, which is what stops
 * the placeholder itself flickering.
 */

// Enough to fill the sidebar on a laptop without inventing a scrollbar.
const ROWS = 7;

// Varied so the column does not read as a printed form. Title, then preview.
const WIDTHS = [
  ["w-24", "w-40"],
  ["w-32", "w-28"],
  ["w-20", "w-36"],
  ["w-36", "w-24"],
  ["w-28", "w-32"],
  ["w-24", "w-44"],
  ["w-32", "w-20"],
] as const;

export function ConversationListSkeleton() {
  return (
    <SkeletonRegion label="Loading your chats" className="space-y-1">
      {Array.from({ length: ROWS }, (_, row) => {
        const [title, preview] = WIDTHS[row % WIDTHS.length];
        return (
          <div
            key={row}
            className="w-full rounded-xl border border-transparent bg-white px-3 py-2.5 dark:bg-slate-800"
          >
            <div className="flex items-center gap-3 pr-7">
              <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
              <div className="min-w-0 flex-1">
                <Skeleton className={`h-3.5 ${title}`} />
                <Skeleton className={`mt-2 h-3 ${preview}`} />
              </div>
              <Skeleton className="h-2.5 w-10 shrink-0" />
            </div>
          </div>
        );
      })}
    </SkeletonRegion>
  );
}
