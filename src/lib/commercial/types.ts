/**
 * The commercial area's data, as the frontend holds it.
 *
 * `Company` here and on the backend (`commercial.Company` - what the product
 * plan calls "the advertiser"), so nothing translates one name into another;
 * api.ts only turns snake_case into camelCase. The subscription tier
 * called "Business" (billing.Plan) is a different thing: that is a `plan`, and
 * nothing about it lives in this folder.
 *
 * Mirrors backend/commercial/models/ - camelCase here, snake_case on the wire, and
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

/**
 * Active from the moment it is created: Loopd'n reviews campaigns, not
 * companies. Staff can suspend one.
 */
export type CompanyStatus = "active" | "suspended";

/** A company that buys ads - not the person signed in to buy them. */
export type Company = {
  id: number;
  /** What a sponsored message is labelled with: "Sponsored · Joe's Pizza". */
  name: string;
  /** An `Industry` slug. */
  industry: string;
  industryLabel: string;
  /** ISO 3166-1 alpha-2: "PH", "US". */
  country: string;
  /** ISO 4217: "PHP", "USD". Every amount for this company is in it. */
  currency: string;
  /** True once money has moved, after which the currency cannot change. */
  currencyLocked: boolean;
  contactEmail: string;
  /** Optional details, filled in after setup. Phone is E.164: "+639171234567". */
  contactPhone: string;
  website: string;
  address: string;
  /** The company in its own words, up to 500 characters. */
  description: string;
  logoUrl: string | null;
  status: CompanyStatus;
  /**
   * Prepaid ad money AVAILABLE for new campaigns. NOT the user's billing
   * wallet, which is SMS credit.
   */
  balanceCents: number;
  /** Set aside for submitted campaigns and not yet spent. */
  reservedCents: number;
  createdAt: string | null;
};

/** What a company does - "Food and drink". The company form's first list. */
export type Industry = { slug: string; label: string };

/** An ISO 3166-2 region a campaign can target: "PH-10", Northern Mindanao. */
export type Region = { code: string; name: string };

/**
 * Where a company can advertise, what it can pay in, and the regions a
 * campaign in each country can target (backend markets.py).
 */
export type Markets = {
  countries: {
    code: string;
    name: string;
    defaultCurrency: string;
    regions: Region[];
  }[];
  currencies: { code: string; name: string; minTopUpCents: number }[];
};

/**
 * What "Set up your company" and the Company page send. `logo` is a new file
 * to upload, `null` to remove the current one, or absent to leave it alone.
 */
export type CompanyInput = {
  name: string;
  industry: string;
  country: string;
  currency: string;
  contactEmail: string;
  website: string;
  /** Edited on the company's details, not asked for when creating one. */
  contactPhone?: string;
  address?: string;
  description?: string;
  logo?: File | null;
};

export type CampaignObjective =
  "call" | "text" | "website" | "lead" | "booking" | "group_join";

export type CampaignStatus =
  "draft" | "pending_review" | "approved" | "running" | "paused" | "ended";

export type CampaignPacing = "standard" | "accelerated";

/** Where the ad appears. A card in a group's chat is the only one so far. */
export type CampaignPlacement = "chat";

/**
 * An *ad* campaign - never the A2P/10DLC carrier sense of the word.
 *
 * A draft may be incomplete: the builder saves each step as it goes, so the
 * name may be blank and the budget null until submit checks the whole thing.
 */
export type Campaign = {
  id: number;
  companyId: number;
  /** Blank on a draft nobody has named yet; show campaignName() instead. */
  name: string;
  objective: CampaignObjective;
  placement: CampaignPlacement;
  status: CampaignStatus;
  pacing: CampaignPacing;
  /** Null on a draft whose budget step is not done. */
  totalBudgetCents: number | null;
  /** Null means no daily cap. */
  dailyBudgetCents: number | null;
  /** The company's currency: every amount above is in it. */
  currency: string;
  /** The company's country: the market its regions are in. */
  country: string;
  /** The price per 1,000 views it was submitted at; null on a draft. */
  cpmCents: number | null;
  /** Its share of the company's reserved money, not yet spent. */
  reservedCents: number;
  spentCents: number;
  /** Null start: as soon as it is approved. Null end: until the budget is spent. */
  startsAt: string | null;
  endsAt: string | null;
  createdAt: string | null;
};

/** One kind of group an audience can include: "School". */
export type GroupCategory = { slug: string; label: string };

/**
 * Who a campaign is for. Each part empty means "any": any kind of group,
 * anywhere in the company's country, any size above the privacy floor.
 */
export type Audience = {
  /** GroupCategory slugs. */
  categories: string[];
  /** Region codes in the company's country. */
  regions: string[];
  minGroupSize: number | null;
  maxGroupSize: number | null;
};

/** A count the server will only ever give as "between these two". */
export type ReachRange = { low: number; high: number | null };

/** How many an audience reaches - never an exact count, never a group. */
export type ReachEstimate =
  | { available: true; groups: ReachRange; members: ReachRange }
  | { available: false; reason: string };

export type CreativeCtaKind = "call" | "text" | "link" | "group_join";

export type CreativeStatus =
  "draft" | "pending_review" | "approved" | "rejected";

/** One version of the ad: what it says, shows, and where its button goes. */
export type Creative = {
  id: number;
  campaignId: number;
  headline: string;
  body: string;
  imageUrl: string | null;
  ctaLabel: string;
  ctaKind: CreativeCtaKind;
  /** A web address, or a Loopd'n link for a group join. */
  ctaTarget: string;
  status: CreativeStatus;
  /** Why review rejected it, when it did. */
  reviewNotes: string;
};

/**
 * What a creative form sends. `image` is a new file to upload, `null` to
 * remove the current one, or absent to leave it alone.
 */
export type CreativeInput = {
  headline: string;
  body: string;
  ctaLabel: string;
  ctaTarget: string;
  image?: File | null;
};

/** One line of a campaign's history. */
export type CampaignEvent = {
  kind: string;
  /** "Submitted for review". */
  label: string;
  /** Who did it - a person, "Loopd'n" for review - or null for the system. */
  by: string | null;
  note: string;
  createdAt: string | null;
};

/** One campaign with everything the builder and the campaign page show. */
export type CampaignDetail = Campaign & {
  /** Null until the audience step has been saved; "any" is a saved audience. */
  audience: Audience | null;
  creatives: Creative[];
  events: CampaignEvent[];
  /** A draft that never moved money: only then can it be deleted. */
  deletable: boolean;
};

/** What 1,000 viewed ads cost now, in the company's currency. */
export type Pricing = { currency: string; cpmCents: number };

export type TransactionKind =
  | "credit_purchase"
  | "campaign_reserve"
  | "campaign_spend"
  | "campaign_release"
  | "refund"
  | "adjustment";

/**
 * One line of the company's ledger. Two buckets move: AVAILABLE
 * (`availableChangeCents`) and RESERVED (`reservedChangeCents`), each with
 * where it stood after.
 */
export type Transaction = {
  id: number;
  kind: TransactionKind;
  label: string;
  campaignId: number | null;
  campaignName: string | null;
  availableChangeCents: number;
  availableAfterCents: number;
  reservedChangeCents: number;
  reservedAfterCents: number;
  description: string;
  createdAt: string | null;
};

/** What a builder step saves. Only the fields given are sent. */
export type CampaignChanges = Partial<{
  name: string;
  objective: CampaignObjective;
  pacing: CampaignPacing;
  totalBudgetCents: number | null;
  dailyBudgetCents: number | null;
  startsAt: string | null;
  endsAt: string | null;
}>;

/**
 * What every lib/commercial call resolves to. Never throws.
 *
 * `fieldErrors` is the server's per-field message, keyed by the API's field
 * name (`contact_email`), when it refused a form.
 */
export type CompanyResult<T> =
  | { ok: true; data: T }
  | { ok: false; message: string; fieldErrors?: Record<string, string> };
