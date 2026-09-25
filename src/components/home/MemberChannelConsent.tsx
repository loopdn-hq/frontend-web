"use client";

import type { ChannelConsentState } from "@/lib/chat/conversations";

/**
 * Where one member stands on each delivery channel.
 *
 * FOUR STATES, NOT A TICKBOX. "Off" and "never answered" look identical as a
 * boolean and mean completely different things to whoever is looking at this
 * screen: one person declined, the other was never asked. An admin wondering
 * why somebody is not getting texts needs to tell those apart.
 *
 * Channels are read from whatever the server sent rather than named here, so
 * a channel added on the backend appears without a change to this file. A
 * member with no row for a channel is skipped entirely - listing "voice: never
 * asked" against every member is noise until voice exists.
 */

type MemberChannelConsentProps = {
  channels: Record<string, ChannelConsentState>;
};

const LABEL: Record<string, string> = {
  sms: "SMS",
  email: "Email",
  voice: "Voice",
};

// Wording and colour per state. `declined` and `opted_out` are deliberately
// distinct: declining this group is reversible by replying YES, while an
// opt-out is the carrier's word and only the person can undo it.
const STATE: Record<string, { text: string; className: string; hint: string }> =
  {
    opted_in: {
      text: "on",
      className:
        "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300",
      hint: "Agreed to receive this channel",
    },
    pending: {
      text: "pending",
      className:
        "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300",
      hint: "Asked, no answer yet — nothing is sent until they agree",
    },
    declined: {
      text: "declined",
      className:
        "border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400",
      hint: "Said no to this group. They can still change their mind",
    },
    opted_out: {
      text: "stopped",
      className:
        "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300",
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
    <div className="mt-1.5 flex flex-wrap items-center gap-1">
      {shown.map(([channel, state]) => {
        const look = STATE[state.status ?? ""] ?? STATE.declined;
        const name = LABEL[channel] ?? channel;
        // The dates matter: `consentedAt` is the answer to "when did they
        // agree", which is the question a consent complaint turns on.
        const title =
          `${name}: ${look.hint}` +
          when("Asked", state.askedAt) +
          when("Agreed", state.consentedAt) +
          when("Opted out", state.optedOutAt);

        return (
          <span
            key={channel}
            title={title}
            className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] leading-none font-medium ${look.className}`}
          >
            {name} {look.text}
          </span>
        );
      })}
    </div>
  );
}
