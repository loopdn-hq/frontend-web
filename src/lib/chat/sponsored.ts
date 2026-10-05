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
  /**
   * The button's address: the server's /c/{token}/, which counts the click
   * and sends the member on to the company's page. Null for a lead form.
   */
  clickUrl: string | null;
  /** A lead form's button: opens Loopd'n's own form with this. Else null. */
  formToken: string | null;
};

/** Where a lead form starts, and what the member agrees to by sending it. */
export type LeadForm = {
  companyName: string;
  headline: string;
  fields: { name: string; phone: string; email: string };
  consent: string;
  alreadySent: boolean;
};

export type LeadDetails = {
  name: string;
  phone: string;
  email: string;
  message: string;
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
  const clickUrl = isObject(data) ? asNullableText(data.click_url) : null;
  const formToken = isObject(data) ? asNullableText(data.form_token) : null;
  if (!isObject(data) || typeof data.token !== "string") {
    return { ok: true, data: null };
  }
  // A card with no way to press its button is no card.
  if (!clickUrl && !formToken) return { ok: true, data: null };
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
      clickUrl,
      formToken,
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

/**
 * Open a lead form: where to start from, pre-filled from the member's
 * profile. Opening it is the button's press, so the server counts the click.
 */
export async function openLeadForm(
  formToken: string,
): Promise<ApiResult<LeadForm>> {
  const result = await apiRequest(
    "/commercial/lead-form/",
    { method: "POST", ...jsonBody({ token: formToken }) },
    "Couldn't open the form.",
  );
  if (!result.ok) return result;
  const data = isObject(result.data) ? result.data : {};
  const fields = isObject(data.fields) ? data.fields : {};
  return {
    ok: true,
    data: {
      companyName: asText(data.company_name),
      headline: asText(data.headline),
      fields: {
        name: asText(fields.name),
        phone: asText(fields.phone),
        email: asText(fields.email),
      },
      consent: asText(data.consent),
      alreadySent: data.already_sent === true,
    },
  };
}

/** Send what the member chose to the company. `fieldErrors` names each wrong field. */
export async function sendLead(
  formToken: string,
  details: LeadDetails,
): Promise<ApiResult<unknown>> {
  return apiRequest(
    "/commercial/leads/",
    { method: "POST", ...jsonBody({ token: formToken, ...details }) },
    "Couldn't send your details.",
  );
}
