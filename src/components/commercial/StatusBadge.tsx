import { Badge } from "@/components/ui";
import {
  COMPANY_STATUS_LABEL,
  CAMPAIGN_STATUS_LABEL,
  CREATIVE_STATUS_LABEL,
} from "@/lib/commercial/format";
import type {
  CompanyStatus,
  CampaignStatus,
  CreativeStatus,
} from "@/lib/commercial/types";

type Tone = "neutral" | "success" | "warning" | "info" | "danger";

const COMPANY_TONE: Record<CompanyStatus, Tone> = {
  active: "success",
  suspended: "warning",
};

// "Waiting on somebody" is warning; a draft is still the owner's to finish;
// "done" is neutral.
const CAMPAIGN_TONE: Record<CampaignStatus, Tone> = {
  draft: "info",
  pending_review: "warning",
  approved: "warning",
  running: "success",
  paused: "warning",
  ended: "neutral",
};

export function CompanyStatusBadge({
  status,
  className,
}: {
  status: CompanyStatus;
  className?: string;
}) {
  return (
    <Badge tone={COMPANY_TONE[status]} className={className}>
      {COMPANY_STATUS_LABEL[status]}
    </Badge>
  );
}

export function CampaignStatusBadge({
  status,
  className,
}: {
  status: CampaignStatus;
  className?: string;
}) {
  return (
    <Badge tone={CAMPAIGN_TONE[status]} className={className}>
      {CAMPAIGN_STATUS_LABEL[status]}
    </Badge>
  );
}

const CREATIVE_TONE: Record<CreativeStatus, Tone> = {
  draft: "info",
  pending_review: "warning",
  approved: "success",
  rejected: "danger",
};

export function CreativeStatusBadge({
  status,
  className,
}: {
  status: CreativeStatus;
  className?: string;
}) {
  return (
    <Badge tone={CREATIVE_TONE[status]} className={className}>
      {CREATIVE_STATUS_LABEL[status]}
    </Badge>
  );
}
