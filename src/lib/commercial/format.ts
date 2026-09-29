import type { CompanyStatus, CampaignObjective, CampaignStatus } from "./types";

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
