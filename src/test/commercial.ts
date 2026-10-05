import type { CampaignOptions } from "@/lib/commercial/useCampaignOptions";
import type { CampaignDetail, Company, Creative } from "@/lib/commercial/types";

/** Fixtures for the commercial dashboard's tests. */

export function company(overrides: Partial<Company> = {}): Company {
  return {
    id: 3,
    name: "Acme",
    industry: "retail",
    industryLabel: "Retail",
    country: "US",
    currency: "USD",
    currencyLocked: false,
    contactEmail: "ads@acme.example",
    contactPhone: "+14155552671",
    website: "https://acme.example",
    address: "1 Main St",
    description: "Things.",
    logoUrl: null,
    status: "active",
    balanceCents: 12_000,
    reservedCents: 5_000,
    createdAt: "2026-09-01T00:00:00Z",
    ...overrides,
  };
}

export function creative(overrides: Partial<Creative> = {}): Creative {
  return {
    id: 1,
    campaignId: 12,
    headline: "Half off",
    body: "This week only.",
    imageUrl: null,
    ctaLabel: "Shop now",
    ctaKind: "link",
    ctaTarget: "https://acme.example/offer",
    status: "draft",
    reviewNotes: "",
    ...overrides,
  };
}

export function campaign(
  overrides: Partial<CampaignDetail> = {},
): CampaignDetail {
  return {
    id: 12,
    companyId: 3,
    name: "Autumn sale",
    objective: "website",
    placement: "chat",
    status: "draft",
    pacing: "standard",
    totalBudgetCents: 50_000,
    dailyBudgetCents: null,
    currency: "USD",
    country: "US",
    cpmCents: 800,
    reservedCents: 0,
    spentCents: 0,
    startsAt: null,
    endsAt: null,
    createdAt: "2026-10-01T00:00:00Z",
    audience: {
      categories: ["sports"],
      regions: ["US-CA"],
      minGroupSize: 10,
      maxGroupSize: null,
    },
    creatives: [creative()],
    events: [],
    deletable: true,
    ...overrides,
  };
}

export const OPTIONS: CampaignOptions = {
  categories: [
    { slug: "sports", label: "Sports" },
    { slug: "arts", label: "Arts" },
  ],
  markets: {
    countries: [
      {
        code: "US",
        name: "United States",
        defaultCurrency: "USD",
        regions: [
          { code: "US-CA", name: "California" },
          { code: "US-NY", name: "New York" },
        ],
      },
      { code: "PH", name: "Philippines", defaultCurrency: "PHP", regions: [] },
    ],
    currencies: [
      { code: "USD", name: "US dollar", minTopUpCents: 1_000 },
      { code: "PHP", name: "Philippine peso", minTopUpCents: 50_000 },
    ],
  },
};
