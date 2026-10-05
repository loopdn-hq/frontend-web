import type { CampaignOptions } from "@/lib/commercial/useCampaignOptions";
import type { CampaignDetail, Company } from "@/lib/commercial/types";

/**
 * The builder's six steps (backend plan, section 7), in order. The step
 * showing is in the address (`?id=12&step=audience`), so a reload, a shared
 * link or the back button lands where the person was.
 */
export const STEPS = [
  { key: "objective", title: "Objective", short: "Objective" },
  { key: "audience", title: "Audience", short: "Audience" },
  { key: "reach", title: "Reach", short: "Reach" },
  { key: "budget", title: "Budget and schedule", short: "Budget" },
  { key: "creatives", title: "Creatives", short: "Creatives" },
  { key: "review", title: "Review", short: "Review" },
] as const;

export type StepKey = (typeof STEPS)[number]["key"];

export function isStepKey(value: string | null): value is StepKey {
  return STEPS.some((step) => step.key === value);
}

/** What every step after the first is given. */
export type StepProps = {
  campaign: CampaignDetail;
  company: Company;
  options: CampaignOptions;
  /** Take what the server returned after a save. */
  onSaved: (campaign: CampaignDetail) => void;
  goTo: (step: StepKey) => void;
};

/**
 * The step that fixes each thing submit can refuse, keyed as the server
 * names them (backend services/campaigns.py, submit_problems).
 */
export const STEP_OF_PROBLEM: Record<string, StepKey> = {
  name: "objective",
  objective: "objective",
  audience: "audience",
  total_budget_cents: "budget",
  daily_budget_cents: "budget",
  starts_at: "budget",
  ends_at: "budget",
  pacing: "budget",
  creatives: "creatives",
};

// ---- Money -------------------------------------------------------------

/**
 * Cents from what a person types: "1,500" or "1500.50". Null for nothing
 * typed, NaN for something that is not an amount.
 */
export function toCents(text: string): number | null {
  const cleaned = text.replace(/,/g, "").trim();
  if (!cleaned) return null;
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return Number.NaN;
  return Math.round(Number(cleaned) * 100);
}

/** What to show in an amount field for a stored value: "1500" or "1500.50". */
export function fromCents(cents: number | null): string {
  if (cents === null) return "";
  return cents % 100 === 0 ? String(cents / 100) : (cents / 100).toFixed(2);
}

// ---- Dates -----------------------------------------------------------------
//
// The builder asks for days, in the person's own time zone. A start date
// begins at midnight that day; an end date runs to the end of it.

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function asDateInput(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** "2026-10-14" for a stored time, in local time; "" for none. */
export function dateInputValue(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "" : asDateInput(date);
}

/** The earliest start a date picker offers. Review takes time, and starting
 * "today" is what "as soon as it's approved" already means. */
export function tomorrow(): string {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return asDateInput(date);
}

export function startOfDay(day: string): string {
  return new Date(`${day}T00:00:00`).toISOString();
}

export function endOfDay(day: string): string {
  return new Date(`${day}T23:59:59`).toISOString();
}

/** "https://" in front of what people usually type: "luna.example/menu". */
export function withScheme(address: string): string {
  const trimmed = address.trim();
  if (!trimmed || /^[a-z][a-z0-9+.-]*:/i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}
