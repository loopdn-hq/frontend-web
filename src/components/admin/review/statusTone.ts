import type { CampaignStatus } from "@/lib/admin/types";

/** A campaign status's badge colour on the admin site. */
export const STATUS_TONE: Record<
  CampaignStatus,
  "neutral" | "success" | "warning" | "info"
> = {
  draft: "info",
  pending_review: "warning",
  approved: "success",
  running: "success",
  paused: "warning",
  ended: "neutral",
};
