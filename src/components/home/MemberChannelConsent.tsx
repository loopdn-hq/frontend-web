"use client";

import { Check, Inbox, Mail, MessageCircle, Phone } from "lucide-react";
import type { ChannelConsentState } from "@/lib/chat/conversations";

/**
 * Where one member stands on each delivery channel.
 *
 * FOUR STATES, NOT A TICKBOX. "Off" and "never answered" look identical as a
 * boolean and mean completely different things to whoever is reading this
 * screen: one person declined, the other was never asked. An admin wondering
 * why somebody is not getting texts needs to tell those apart.
 *
 * Channels come from whatever the server sent rather than being named here, so
 * a channel added on the backend appears without a change to this file. A
 * member with no row for a channel is skipped - listing "voice, never asked"
 * against every member is noise until voice exists.
 */

type MemberChannelConsentProps = {
  channels: Record<string, ChannelConsentState>;
};

const CHANNEL: Record<string, { label: string; Icon: typeof MessageCircle }> = {
  sms: { label: "SMS", Icon: MessageCircle },
  email: { label: "Email", Icon: Mail },
  voice: { label: "Voice", Icon: Phone },
};

// `declined` and `opted_out` stay distinct on purpose: declining this group is
// reversible by replying YES, while an opt-out is the carrier's word and only
// the person themselves can undo it.
const STATE: Record<
  string,
  { suffix: string; tick: boolean; className: string; hint: string }
> = {
  opted_in: {
    suffix: "",
    tick: true,
    className:
      "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
    hint: "Agreed to receive this channel",
  },
  pending: {
    suffix: "pending",
    tick: false,
    className:
      "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
    hint: "Asked, no answer yet — nothing is sent until they agree",
  },
  declined: {
    suffix: "declined",
    tick: false,
    className:
      "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
    hint: "Said no to this group. They can still change their mind",
  },
  opted_out: {
    suffix: "stopped",
    tick: false,
    className:
      "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300",
    hint: "Opted out. Only they can undo this",
  },
};

function when(label: string, value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `\n${label} ${date.toLocaleDateString()} at ${date.toLocaleTimeString(
    [],
    { hour: "2-digit", minute: "2-digit" },
  )}`;
}

export function MemberChannelConsent({ channels }: MemberChannelConsentProps) {
  const shown = Object.entries(channels).filter(
    ([, state]) => state.status !== null,
  );
  if (shown.length === 0) return null;

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <span className="flex shrink-0 items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
        <Inbox className="h-3.5 w-3.5" aria-hidden />
        Delivery
      </span>
      <span
        aria-hidden
        className="h-4 w-px shrink-0 bg-slate-200 dark:bg-slate-700"
      />

      {shown.map(([channel, state]) => {
        const look = STATE[state.status ?? ""] ?? STATE.declined;
        const meta = CHANNEL[channel] ?? { label: channel, Icon: Inbox };
        const { Icon } = meta;
        // The dates are the point: `consentedAt` answers "when did they agree",
        // which is the question a consent complaint turns on.
        const title =
          `${meta.label}: ${look.hint}` +
          when("Asked", state.askedAt) +
          when("Agreed", state.consentedAt) +
          when("Opted out", state.optedOutAt);

        return (
          <span
            key={channel}
            title={title}
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${look.className}`}
          >
            <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
            {meta.label}
            {look.suffix && ` ${look.suffix}`}
            {look.tick && (
              <Check className="h-3.5 w-3.5 shrink-0" aria-hidden />
            )}
          </span>
        );
      })}
    </div>
  );
}
