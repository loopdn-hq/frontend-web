import {
  Ban,
  CircleAlert,
  Mail,
  MessageSquare,
  Settings,
  Shield,
  UserPlus,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { AppNotification } from "@/lib/chat/notifications";

export type ActivityPresentation = {
  title: string;
  detail?: string;
  icon: LucideIcon;
  // Tailwind classes for the round icon chip. Colour carries meaning here:
  // red is something that went wrong and needs looking at, amber is waiting on
  // somebody, green landed, blue and purple are ordinary membership news.
  tone: string;
};

/**
 * Turn a stored event into the sentence a person reads.
 *
 * Rendered here rather than stored on the row: the notification holds what
 * happened and what it happened to, so renaming a group fixes every past
 * notification about it instead of leaving them all quietly wrong.
 */
export function presentNotification(
  notification: AppNotification,
): ActivityPresentation {
  const who = notification.actorName ?? "Someone";
  const group = notification.conversationName ?? "a group";

  switch (notification.type) {
    case "join.requested":
      return {
        title: `${who} requested to join`,
        icon: UserPlus,
        tone: "bg-sky-100 text-sky-600 dark:bg-sky-950/60 dark:text-sky-300",
      };
    case "join.approved":
      return {
        title: "Your request was approved",
        detail: `You are now in ${group}.`,
        icon: MessageSquare,
        tone: "bg-emerald-100 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-300",
      };
    case "join.declined":
      return {
        title: "Your request was declined",
        icon: Ban,
        tone: "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400",
      };
    case "member.added":
      return {
        title: "You were added to a group",
        detail: notification.actorName ? `Added by ${who}.` : undefined,
        icon: Users,
        tone: "bg-violet-100 text-violet-600 dark:bg-violet-950/60 dark:text-violet-300",
      };
    case "member.removed":
      return {
        title: notification.data?.blocked
          ? "You were blocked from a group"
          : "You were removed from a group",
        icon: Ban,
        tone: "bg-rose-100 text-rose-600 dark:bg-rose-950/60 dark:text-rose-300",
      };
    case "role.granted":
      return {
        title: "You were promoted to admin",
        detail: "You are now an admin.",
        icon: Shield,
        tone: "bg-amber-100 text-amber-600 dark:bg-amber-950/60 dark:text-amber-300",
      };
    case "role.revoked":
      return {
        title: "You are no longer an admin",
        icon: Shield,
        tone: "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400",
      };
    case "group.mode_changed":
      return {
        title: "Group mode changed to Broadcast",
        detail: "Only admins can now send messages.",
        icon: Settings,
        tone: "bg-sky-100 text-sky-600 dark:bg-sky-950/60 dark:text-sky-300",
      };
    case "sms.opted_out":
      return {
        title: `${who} opted out of SMS`,
        detail:
          "They texted STOP and will no longer receive SMS from this group.",
        icon: Ban,
        tone: "bg-rose-100 text-rose-600 dark:bg-rose-950/60 dark:text-rose-300",
      };
    case "sms.opted_in":
      return {
        title: `${who} accepted your invitation`,
        icon: MessageSquare,
        tone: "bg-emerald-100 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-300",
      };
    case "sms.send_failed":
      return {
        title: "A message did not reach everyone",
        detail: "SMS delivery failed for some members.",
        icon: CircleAlert,
        tone: "bg-rose-100 text-rose-600 dark:bg-rose-950/60 dark:text-rose-300",
      };
    case "sms.invite_pending":
      return {
        title: "Invitation still pending",
        detail: `${who} has not replied yet.`,
        icon: Mail,
        tone: "bg-amber-100 text-amber-600 dark:bg-amber-950/60 dark:text-amber-300",
      };
    default:
      return {
        title: "Something happened",
        icon: MessageSquare,
        tone: "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400",
      };
  }
}

/** Today / Yesterday / an absolute date, for the group headings. */
export function dayBucket(iso: string): string {
  if (!iso) return "Earlier";
  const when = new Date(iso);
  const today = new Date();
  const startOfToday = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  ).getTime();
  const startOfWhen = new Date(
    when.getFullYear(),
    when.getMonth(),
    when.getDate(),
  ).getTime();

  const days = Math.round((startOfToday - startOfWhen) / 86_400_000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  return "Earlier";
}

export function timeLabel(iso: string, bucket: string): string {
  if (!iso) return "";
  const when = new Date(iso);
  const time = when.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
  if (bucket === "Today") return time;
  if (bucket === "Yesterday") return `Yesterday, ${time}`;
  return `${when.toLocaleDateString([], { month: "short", day: "numeric" })}, ${time}`;
}
