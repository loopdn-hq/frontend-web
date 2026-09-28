import { Badge } from "@/components/ui";
import {
  COMPANY_STATUS_LABEL,
  CAMPAIGN_STATUS_LABEL,
} from "@/lib/commercial/format";
import type { CompanyStatus, CampaignStatus } from "@/lib/commercial/types";

type Tone = "neutral" | "success" | "warning";

const COMPANY_TONE: Record<CompanyStatus, Tone> = {
  pending: "warning",
  active: "success",
  suspended: "warning",
};

// "Waiting on somebody" is warning; "done, or not started" is neutral.
const CAMPAIGN_TONE: Record<CampaignStatus, Tone> = {
  draft: "neutral",
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
