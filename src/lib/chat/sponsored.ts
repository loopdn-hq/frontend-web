// The chat app's side of campaigns (slice 5 of
// backend/docs/campaigns_final_plan.md): ask for a card for this member in
// this group, and say when it was seen. A card is never a message - it is
// not stored with the conversation and never counts as unread.

import {
  apiRequest,
  asNullableText,
  asText,
  isObject,
  jsonBody,
  type ApiResult,
} from "@/lib/api/envelope";
import type { SponsoredCtaKind } from "@/components/sponsored/SponsoredCard";

export type SponsoredCardData = {
  /** Signed by the server; handed back when the card has been seen. */
  token: string;
  companyName: string;
  headline: string;
  body: string;
  imageUrl: string | null;
  ctaLabel: string;
  ctaKind: SponsoredCtaKind;
  ctaTarget: string;
};

/** A card for this member in this group, or null - which is the usual answer. */
export async function fetchSponsoredCard(
  conversationId: string | number,
): Promise<ApiResult<SponsoredCardData | null>> {
  const result = await apiRequest(
    `/commercial/serve/?placement=chat&conversation=${encodeURIComponent(String(conversationId))}`,
    {},
    "Couldn't load the sponsored card.",
  );
  if (!result.ok) return result;
  const data = result.data;
  if (!isObject(data) || typeof data.token !== "string") {
    return { ok: true, data: null };
  }
  const company = isObject(data.company) ? data.company : {};
  const creative = isObject(data.creative) ? data.creative : {};
  return {
    ok: true,
    data: {
      token: data.token,
      companyName: asText(company.name),
      headline: asText(creative.headline),
      body: asText(creative.body),
      imageUrl: asNullableText(creative.image_url),
      ctaLabel: asText(creative.cta_label),
      ctaKind: asText(creative.cta_kind, "link") as SponsoredCtaKind,
      ctaTarget: asText(creative.cta_target),
    },
  };
}

/** The card was seen: at least half of it on screen for a second. Counted once. */
export async function reportSponsoredView(token: string): Promise<void> {
  await apiRequest(
    "/commercial/impressions/",
    { method: "POST", ...jsonBody({ token }) },
    "Couldn't record the view.",
  );
}
