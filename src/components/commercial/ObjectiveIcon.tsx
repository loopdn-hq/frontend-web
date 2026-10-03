import {
  CalendarCheck,
  Megaphone,
  MessageSquare,
  Phone,
  UserPlus,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { CampaignObjective } from "@/lib/commercial/types";
import { cn } from "@/lib/ui/cn";

// A record, so a new objective is a type error here until it has its look.
const LOOK: Record<CampaignObjective, { icon: LucideIcon; tint: string }> = {
  website: {
    icon: Megaphone,
    tint: "bg-sky-100 text-sky-600 dark:bg-sky-950 dark:text-sky-300",
  },
  lead: {
    icon: UserPlus,
    tint: "bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-300",
  },
  booking: {
    icon: CalendarCheck,
    tint: "bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-300",
  },
  group_join: {
    icon: Users,
    tint: "bg-violet-100 text-violet-600 dark:bg-violet-950 dark:text-violet-300",
  },
  call: {
    icon: Phone,
    tint: "bg-rose-100 text-rose-600 dark:bg-rose-950 dark:text-rose-300",
  },
  text: {
    icon: MessageSquare,
    tint: "bg-indigo-100 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-300",
  },
};

/** A campaign's tile in the list: its objective at a glance, by icon and colour. */
export function ObjectiveIcon({
  objective,
  className,
}: {
  objective: CampaignObjective;
  className?: string;
}) {
  const { icon: Icon, tint } = LOOK[objective];
  return (
    <span
      className={cn(
        "grid h-11 w-11 shrink-0 place-items-center rounded-xl",
        tint,
        className,
      )}
    >
      <Icon className="h-5 w-5" aria-hidden />
    </span>
  );
}
