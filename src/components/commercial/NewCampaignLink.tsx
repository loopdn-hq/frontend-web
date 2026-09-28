import Link from "next/link";
import { Plus } from "lucide-react";

/**
 * The primary action in the header of the overview and the campaign list: a
 * round "+" on the blue bar, like "New conversation" in the chat list.
 */
export function NewCampaignLink() {
  return (
    <Link
      href="/campaigns/new/"
      title="New campaign"
      aria-label="New campaign"
      className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20 text-white transition hover:bg-white/30"
    >
      <Plus className="h-5 w-5" aria-hidden />
    </Link>
  );
}
