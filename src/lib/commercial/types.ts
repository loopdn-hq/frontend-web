/**
 * The commercial area's data, as the frontend holds it.
 *
 * `Company` here and on the backend (`commercial.Company` - what the product
 * plan calls "the advertiser"), so nothing translates one name into another;
 * api.ts only turns snake_case into camelCase. The subscription tier
 * called "Business" (billing.Plan) is a different thing: that is a `plan`, and
 * nothing about it lives in this folder.
 *
 * Mirrors backend/ads/models/ - camelCase here, snake_case on the wire, and
 * api.ts is the only place that converts between the two. The string unions
 * are the backend's TextChoices values exactly, so a new status on the server
 * is a compile error in format.ts rather than a blank badge.
 *
 * What is deliberately NOT here: anything that points at a person or a
 * conversation. A company gets campaign ids and aggregate counters, never
 * a participant, a member list or a group (backend plan, "Privacy and trust").
 * If a type in this file ever grows a `conversationId`, something upstream has
 * gone wrong.
 */

/** A company that buys ads - not the person signed in to buy them. */
export type CompanyStatus = "pending" | "active" | "suspended";

export type Company = {
  id: number;
  /** What a sponsored message is labelled with: "Sponsored · Joe's Pizza". */
  name: string;
  website: string;
  contactEmail: string;
  status: CompanyStatus;
  /** Prepaid ad balance. NOT the user's billing wallet, which is SMS credit. */
  balanceCents: number;
  createdAt: string | null;
};

export type CampaignObjective =
  "call" | "text" | "website" | "lead" | "booking" | "group_join";

export type CampaignStatus =
  "draft" | "pending_review" | "approved" | "running" | "paused" | "ended";

export type CampaignPacing = "standard" | "accelerated";

/** An *ad* campaign - never the A2P/10DLC carrier sense of the word. */
export type Campaign = {
  id: number;
  companyId: number;
  name: string;
  objective: CampaignObjective;
  status: CampaignStatus;
  pacing: CampaignPacing;
  totalBudgetCents: number;
  /** Null means no daily cap. */
  dailyBudgetCents: number | null;
  /** Null while it is a draft nobody has scheduled. */
  startsAt: string | null;
  endsAt: string | null;
  createdAt: string | null;
};

/** What every lib/commercial call resolves to. Never throws. */
export type CompanyResult<T> =
  { ok: true; data: T } | { ok: false; message: string };
