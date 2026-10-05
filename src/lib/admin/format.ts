import { formatCents } from "@/lib/format/money";

// Money is shared (lib/format); re-exported so the admin area imports all of
// its formatting from one place.
export { formatCents };

/** "Oct 2, 2026", or "" for nothing. */
export function formatDay(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ""
    : date.toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
}

/** "Oct 2, 2026 at 12:41 AM", or "" for nothing. */
export function formatMoment(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const time = date.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
  return `${formatDay(value)} at ${time}`;
}

/** An amount that may not be set. */
export function formatBudget(cents: number | null, currency: string): string {
  return cents === null ? "Not set" : formatCents(cents, currency);
}
