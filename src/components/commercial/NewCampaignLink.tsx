import Link from "next/link";
import { Plus } from "lucide-react";

/** The primary action on the overview and the campaign list. */
export function NewCampaignLink() {
  return (
    <Link
      href="/commercial/campaigns/new/"
      className="inline-flex min-h-9 items-center gap-1.5 rounded-xl bg-[linear-gradient(130deg,#00a6ff_0%,#1f7fe6_100%)] px-3 text-sm font-semibold text-white hover:brightness-110"
    >
      <Plus className="h-4 w-4" aria-hidden />
      New campaign
    </Link>
  );
}
