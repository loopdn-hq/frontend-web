import Link from "next/link";
import { Plus } from "lucide-react";

/**
 * The primary action in the title row of the overview and the campaign list.
 */
export function NewCampaignLink() {
  return (
    <Link
      href="/campaigns/new/"
      className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-sky-600 px-4 text-sm font-semibold text-white transition hover:bg-sky-700"
    >
      <Plus className="h-4 w-4" aria-hidden />
      New campaign
    </Link>
  );
}
