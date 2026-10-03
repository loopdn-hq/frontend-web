/**
 * The admin site's data, as its pages hold it. Mirrors
 * backend/platform_admin/serializers/ - camelCase here, snake_case on the
 * wire, and api.ts is the only place that converts. Labels ("Website visits",
 * "Pending review") come from the server, so this area keeps no copy of them.
 *
 * Its own types, not the commercial area's: the lint boundary keeps the two
 * apart, and an admin sees more of a campaign than its company does.
 */

/** A campaign status, as the backend's Campaign.Status values. */
export type CampaignStatus =
  "draft" | "pending_review" | "approved" | "running" | "paused" | "ended";

/** One row of the review queue. */
export type ReviewQueueItem = {
  id: number;
  name: string;
  objectiveLabel: string;
  status: CampaignStatus;
  statusLabel: string;
  companyName: string;
  totalBudgetCents: number | null;
  currency: string;
  submittedAt: string | null;
  creativeCount: number;
};

/** What the automatic checks found. A blocker stops approval. */
export type Finding = {
  code: string;
  severity: "blocker" | "warning";
  message: string;
  creativeId: number | null;
};

export type ReviewCompany = {
  id: number;
  name: string;
  status: string;
  industryLabel: string;
  country: string;
  /** "Philippines". */
  countryName: string;
  website: string;
  contactEmail: string;
  /** The owner's username. */
  owner: string;
};

/** Who a campaign is for, with names. An empty list means "any". */
export type ReviewAudience = {
  categories: { slug: string; label: string }[];
  regions: { code: string; name: string }[];
  minGroupSize: number | null;
  maxGroupSize: number | null;
};

export type ReviewCreative = {
  id: number;
  headline: string;
  body: string;
  imageUrl: string | null;
  ctaLabel: string;
  ctaKind: "call" | "text" | "link" | "group_join" | "lead_form";
  ctaTarget: string;
  status: string;
  reviewNotes: string;
};

/** One line of history, with whoever did it by name. */
export type ReviewEvent = {
  kind: string;
  label: string;
  by: string | null;
  note: string;
  createdAt: string | null;
};

/** One campaign with everything a reviewer decides on. */
export type ReviewCampaign = ReviewQueueItem & {
  dailyBudgetCents: number | null;
  /** The price per 1,000 views it was submitted at. */
  cpmCents: number | null;
  reservedCents: number;
  startsAt: string | null;
  endsAt: string | null;
  company: ReviewCompany;
  audience: ReviewAudience | null;
  creatives: ReviewCreative[];
  events: ReviewEvent[];
  findings: Finding[];
};

/** "Reject" says why, and optionally which creatives were the problem. */
export type Rejection = {
  note: string;
  creatives: { id: number; note: string }[];
};

/** One rule of the audience, held against one group. */
export type MatchCheck = {
  code: string;
  label: string;
  passed: boolean;
  detail: string;
};

/** Does a group match a campaign's audience - and if not, which rule says no. */
export type GroupMatch = {
  group: { id: number; name: string; memberCount: number };
  matches: boolean;
  checks: MatchCheck[];
};
