/**
 * What a conversation row says under its name.
 *
 * Built entirely on the client, from the `last_message` the API already
 * nests. The server also composes a `preview` string, and having two of them
 * is what let the live socket path and the fetched path drift apart once
 * already - a message arriving over the socket lost its "yul: " prefix while
 * the same message fetched a moment later kept it. One implementation, fed by
 * both paths, cannot do that.
 */
import type { ConversationAttachment } from "@/lib/chat/conversations";

// youtu.be, /watch?v=, and Shorts. Deliberately not trying to be exhaustive:
// anything it misses falls through to "Link", which is still better than
// showing a hundred characters of URL in a list row.
const YOUTUBE = /(?:youtube\.com\/(?:watch\?|shorts\/)|youtu\.be\/)/i;
const ONLY_A_URL = /^https?:\/\/\S+$/i;

function describeOne(attachment: ConversationAttachment): string {
  const type = (attachment.contentType ?? "").toLowerCase();
  if (type === "image/gif") return "GIF";
  if (type.startsWith("image/")) return "Photo";
  if (type.startsWith("video/")) return "Video";
  if (type.startsWith("audio/")) return "Voice message";
  if (type === "application/pdf") return "PDF";
  // No content type at all - fall back to what the upload was filed as.
  if (attachment.kind === "image") return "Photo";
  return "File";
}

function describeMany(attachments: ConversationAttachment[]): string {
  const kinds = new Set(attachments.map(describeOne));
  if (kinds.size === 1) {
    const only = [...kinds][0];
    // "2 Photos" reads worse than "2 photos", and "2 GIFs" needs its capital.
    const plural =
      only === "GIF" || only === "PDF" ? `${only}s` : `${only.toLowerCase()}s`;
    return `${attachments.length} ${plural}`;
  }
  return `${attachments.length} attachments`;
}

/**
 * The body half of a preview: what was said, or what was sent instead.
 *
 * A message that is nothing but a link says what the link is rather than
 * printing the URL, which is never the useful part in a one-line row.
 */
export function describeMessageBody(
  text: string,
  attachments: ConversationAttachment[] = [],
): string {
  const trimmed = text.trim();

  if (attachments.length === 1) {
    const one = describeOne(attachments[0]);
    // A caption is more informative than the media type, so it wins.
    return trimmed ? `${one} · ${trimmed}` : one;
  }
  if (attachments.length > 1) {
    const many = describeMany(attachments);
    return trimmed ? `${many} · ${trimmed}` : many;
  }

  if (!trimmed) return "";

  if (ONLY_A_URL.test(trimmed)) {
    return YOUTUBE.test(trimmed) ? "YouTube video" : "Link";
  }

  return trimmed;
}

/** "yul: Photo" - the whole line, or empty when there is nothing to show. */
export function composePreview(senderLabel: string, body: string): string {
  if (!body) return "";
  return senderLabel ? `${senderLabel}: ${body}` : body;
}

/**
 * A list timestamp: the time today, the weekday this week, a date before that.
 *
 * Matches how the rest of the app talks about time - precise when it is
 * recent enough to matter, coarse when it is not.
 */
export function conversationTimeLabel(iso: string | null): string {
  if (!iso) return "";
  const when = new Date(iso);
  if (Number.isNaN(when.getTime())) return "";

  const now = new Date();
  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  ).getTime();
  const startOfWhen = new Date(
    when.getFullYear(),
    when.getMonth(),
    when.getDate(),
  ).getTime();
  const days = Math.round((startOfToday - startOfWhen) / 86_400_000);

  if (days <= 0) {
    return when.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }
  if (days === 1) return "Yesterday";
  if (days < 7) return when.toLocaleDateString([], { weekday: "long" });
  return when.toLocaleDateString([], {
    month: "numeric",
    day: "numeric",
    year: "2-digit",
  });
}

/** Today / Yesterday / a date, for the separators between days of messages. */
export function dayLabel(iso: string): string {
  if (!iso) return "";
  const when = new Date(iso);
  if (Number.isNaN(when.getTime())) return "";

  const now = new Date();
  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  ).getTime();
  const startOfWhen = new Date(
    when.getFullYear(),
    when.getMonth(),
    when.getDate(),
  ).getTime();
  const days = Math.round((startOfToday - startOfWhen) / 86_400_000);

  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return when.toLocaleDateString([], { weekday: "long" });
  return when.toLocaleDateString([], {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}
