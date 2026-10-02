import type {
  CompanyStatus,
  CampaignObjective,
  CampaignPacing,
  CampaignStatus,
  CreativeStatus,
  ReachRange,
} from "./types";

/**
 * Money, from cents. Integer cents on the wire, like billing.Wallet, so the
 * only place a decimal ever appears is here.
 *
 * The currency is the company's and is required: every amount belongs to one
 * company, and a default would print pesos as dollars without a word.
 */
export function formatCents(cents: number, currency: string): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(
    cents / 100,
  );
}

/** A budget that may not be set yet, on a draft. */
export function formatBudget(cents: number | null, currency: string): string {
  return cents === null ? "Not set" : formatCents(cents, currency);
}

/** A campaign's name, or what to call it before it has one. */
export function campaignName(campaign: { name: string }): string {
  return campaign.name.trim() || "Untitled campaign";
}

/** "1,000–2,500", or "1,000,000+" past the top: never a count. */
export function formatRange(range: ReachRange): string {
  const number = (value: number) => value.toLocaleString("en-US");
  return range.high === null
    ? `${number(range.low)}+`
    : `${number(range.low)}–${number(range.high)}`;
}

export function formatDate(value: string | null): string {
  if (!value) return "Not scheduled";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not scheduled";
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

// Records, not switch statements: a status the backend adds is a type error
// here until somebody writes its label.

export const COMPANY_STATUS_LABEL: Record<CompanyStatus, string> = {
  active: "Active",
  suspended: "Suspended",
};

export const CAMPAIGN_STATUS_LABEL: Record<CampaignStatus, string> = {
  draft: "Draft",
  pending_review: "Pending review",
  approved: "Approved",
  running: "Running",
  paused: "Paused",
  ended: "Ended",
};

export const CAMPAIGN_OBJECTIVE_LABEL: Record<CampaignObjective, string> = {
  call: "Phone calls",
  text: "Text messages",
  website: "Website visits",
  lead: "Leads",
  booking: "Bookings",
  group_join: "Group joins",
};

/**
 * What each objective is for, under its name on the builder's first step.
 * Call and text are here for completeness; the builder hides them until
 * tracking numbers exist (backend plan, decision 3).
 */
export const CAMPAIGN_OBJECTIVE_HINT: Record<CampaignObjective, string> = {
  call: "People call you from the ad.",
  text: "People text you from the ad.",
  website: "Send people to your website.",
  lead: "Collect interest through your sign-up or contact page.",
  booking: "Send people to your booking page.",
  group_join: "Invite people to join your Loopd'n group.",
};

export const CAMPAIGN_PACING_LABEL: Record<CampaignPacing, string> = {
  standard: "Spread evenly",
  accelerated: "As fast as possible",
};

export const CREATIVE_STATUS_LABEL: Record<CreativeStatus, string> = {
  draft: "Draft",
  pending_review: "Pending review",
  approved: "Approved",
  rejected: "Rejected",
};
