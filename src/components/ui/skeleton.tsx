"use client";

import { cn } from "@/lib/ui/cn";

/**
 * One grey block standing in for content that has not arrived.
 *
 * A primitive rather than a shape, because a skeleton is only convincing when
 * it has the proportions of the thing it replaces - so each screen composes its
 * own from these. What lives here is the part that must NOT vary: the colour in
 * both themes, the radius, and the animation.
 *
 * `motion-safe:` is doing real work. A pulsing page is exactly what vestibular
 * and attention-related motion sensitivity reacts to, and a skeleton covers the
 * whole screen at the moment somebody is waiting and looking at it. Under
 * `prefers-reduced-motion` the blocks are simply static, which still reads as
 * "loading" without the movement.
 *
 * Always aria-hidden: the blocks are decoration, and a screen reader announcing
 * a dozen empty divs is worse than silence. Wrap a group in `SkeletonRegion`,
 * which says the one useful sentence instead.
 */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        "rounded bg-slate-200 motion-safe:animate-pulse dark:bg-slate-700",
        className,
      )}
    />
  );
}

/**
 * The announcement that goes with a group of blocks.
 *
 * `aria-busy` tells assistive tech the region is mid-update, and the one
 * visually hidden line gives it something to actually say. Without this a
 * skeleton is invisible to anybody not looking at it, and the screen appears to
 * do nothing until the content lands.
 */
export function SkeletonRegion({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  // The label sits OUTSIDE the class-carrying element. `space-y-*` works by a
  // sibling selector, so a label inside it counts as the first child and pushes
  // the first real row down - a small shift, but this component exists to stop
  // exactly that.
  return (
    <div role="status" aria-busy="true">
      <span className="sr-only">{label}</span>
      <div className={className}>{children}</div>
    </div>
  );
}
