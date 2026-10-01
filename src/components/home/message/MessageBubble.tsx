"use client";

import { useRef } from "react";
import Image from "next/image";
import { Check, CheckCheck, CornerUpRight, MoreHorizontal } from "lucide-react";
import { ChatAvatar } from "../ChatAvatar";
import { LinkPreviewCard } from "./LinkPreviewCard";
import { MessageReactions } from "./MessageReactions";
import { DELETED_MESSAGE_TEXT } from "@/lib/chat/messageActions";
import { splitByMentions } from "@/lib/chat/mentions";
import type { ConversationMessage } from "@/lib/chat/conversations";
import type { ContextMenuOrigin } from "@/components/ui/context-menu";

/**
 * One message in the thread.
 *
 * Lifted out of HomeShell, which rendered this inline inside a 2900-line
 * component. What it adds is the affordance for acting on a message - a hover
 * button, a right-click target, and a long press - and the marks that say a
 * message is not simply what was typed: forwarded, edited, deleted, reacted to.
 *
 * A DELETED message still renders. The row survives so replies quoting it keep
 * a parent and read pointers do not dangle; the server withholds the text and
 * the files, and what is left is a tombstone with nothing to act on.
 *
 * There is no separate quick-reaction button. The hover button opens the menu,
 * whose first row is the emoji bar - one click from hover either way, without a
 * second floating surface competing with the menu for the same message.
 */

export type ThreadMessage = {
  id: string | number;
  sender: string;
  senderUsername?: string;
  senderAvatarUrl?: string;
  text: string;
  mine: boolean;
  time: string;
  // Kept alongside the formatted `time` because the day separators and the
  // run-grouping both need to compare real instants, not display strings.
  createdAt: string;
  attachments?: ConversationMessage["attachments"];
  /** Which channel it arrived on - app, sms, email, system. */
  source: ConversationMessage["source"];
  /** The message this one answers, when it answers one. */
  replyTo?: ConversationMessage["replyTo"];
  /** The card for its first link, when it has one. */
  linkPreview?: ConversationMessage["linkPreview"];
  /** One entry per emoji used, in the order they were first used. */
  reactions: ConversationMessage["reactions"];
  /** Passed along from another conversation. Never says who from. */
  forwarded: boolean;
  /** Who it names, for the highlight. The words carry no markup of their own. */
  mentions: ConversationMessage["mentions"];
  mentionsEveryone: boolean;
  editedAt: string | null;
  deletedAt: string | null;
};

type MessageBubbleProps = {
  message: ThreadMessage;
  /** First of a run by this sender, so it gets the avatar and the name. */
  startsRun: boolean;
  isLastOwn: boolean;
  /** How many other members have read up to this message. */
  readers: number;
  /** How many members could report reading it at all. */
  readableCount: number;
  isMenuOpen: boolean;
  onOpenMenu: (messageId: string | number, origin: ContextMenuOrigin) => void;
  /** Who is looking, so a reaction pill knows whether it is theirs. */
  currentUsername: string | null;
  onToggleReaction: (
    messageId: string | number,
    emoji: string,
    reacted: boolean,
  ) => void;
  /** A reaction on this message is in flight. */
  reactionBusy?: boolean;
};

// How long a touch has to be held before it counts as "show me the actions".
const LONG_PRESS_MS = 450;

/**
 * A right-click inside a link, an image or a media player belongs to the
 * browser: "Save image as", "Copy link address" and the audio player's own menu
 * are all more useful there than ours, and taking them away is a regression
 * nobody asked for.
 */
function wantsNativeMenu(target: EventTarget | null): boolean {
  return (
    target instanceof Element &&
    target.closest("a, img, audio, video, [contenteditable]") !== null
  );
}

export function MessageBubble({
  message,
  startsRun,
  isLastOwn,
  readers,
  readableCount,
  isMenuOpen,
  onOpenMenu,
  currentUsername,
  onToggleReaction,
  reactionBusy = false,
}: MessageBubbleProps) {
  const longPress = useRef<number | null>(null);
  const isDeleted = message.deletedAt !== null;

  const openAt = (point: { x: number; y: number }) =>
    onOpenMenu(message.id, point);

  const cancelLongPress = () => {
    if (longPress.current !== null) {
      window.clearTimeout(longPress.current);
      longPress.current = null;
    }
  };

  return (
    <div
      // How the pinned bar scrolls this message back into view.
      data-message-id={message.id}
      className={`group/message relative flex items-start gap-2 ${
        message.mine ? "justify-end" : "justify-start"
      } ${
        // Settings → Appearance → Message spacing. `compact:` applies only
        // when it is set to Compact; Comfortable is these values as they were.
        startsRun ? "mt-3 compact:mt-1.5" : "mt-0.5 compact:mt-px"
      } ${message.mine && isLastOwn ? "mb-4" : ""}`}
      onContextMenu={(event) => {
        // Nothing to act on once it is gone, so the browser keeps its menu.
        if (isDeleted || wantsNativeMenu(event.target)) return;
        event.preventDefault();
        openAt({ x: event.clientX, y: event.clientY });
      }}
      // Touch has no right-click and no hover, so a long press is the only way
      // in on a phone. Android fires `contextmenu` on long press and would
      // otherwise open the menu twice; the timer is cancelled by the move and
      // end handlers, and by that synthetic contextmenu firing first.
      onTouchStart={(event) => {
        if (isDeleted || wantsNativeMenu(event.target)) return;
        const touch = event.touches[0];
        if (!touch) return;
        const point = { x: touch.clientX, y: touch.clientY };
        cancelLongPress();
        longPress.current = window.setTimeout(() => {
          longPress.current = null;
          openAt(point);
        }, LONG_PRESS_MS);
      }}
      onTouchMove={cancelLongPress}
      onTouchEnd={cancelLongPress}
      onTouchCancel={cancelLongPress}
    >
      {/* One avatar per run, and only for other people - your own messages are
          already identified by their side. A spacer keeps continuations
          aligned under the first. */}
      {!message.mine &&
        (startsRun ? (
          <ChatAvatar
            name={message.sender}
            imageUrl={message.senderAvatarUrl}
            size={32}
          />
        ) : (
          <span aria-hidden className="w-8 shrink-0" />
        ))}

      {/* The bubble and its button share a positioning context so the button
          can sit OUTSIDE the bubble without being in the flow. In the flow it
          was a real flex child, and every bubble in the thread was ~36px
          narrower than before the extraction. */}
      <div className="relative min-w-0">
        <article
          className={`max-w-xl rounded-[10px] px-2.5 py-2 compact:py-1 ${
            message.mine
              ? "bg-bubble-out text-on-bubble-out"
              : "bg-bubble-in text-on-bubble-in"
          }`}
        >
          {startsRun && !message.mine && (
            <p className="text-xs font-medium text-brand-ink">
              {message.sender}
            </p>
          )}

          {/* Said once, above the words, and never who it came from: a forward
              crosses conversations, so naming the original sender would tell
              this room about somebody in a room it cannot see. */}
          {message.forwarded && !isDeleted && (
            <p
              className={`mb-0.5 flex items-center gap-1 text-2xs italic ${
                message.mine ? "text-on-bubble-out/80" : "text-ink-muted"
              }`}
            >
              <CornerUpRight className="h-3 w-3" aria-hidden />
              Forwarded
            </p>
          )}

          {/* One level, never a thread. The excerpt is already truncated by
              the server, so this renders what it is given. */}
          {message.replyTo && (
            <blockquote
              className={`mt-0.5 mb-1.5 rounded-lg border-l-2 py-1 pr-2 pl-2 text-xs ${
                message.mine
                  ? "border-on-bubble-out/70 bg-on-bubble-out/15"
                  : "border-line bg-canvas"
              }`}
            >
              <span
                className={`block font-semibold ${
                  message.mine ? "text-on-bubble-out" : "text-brand-ink"
                }`}
              >
                {message.replyTo.sender}
              </span>
              <span
                className={`block truncate ${
                  message.mine ? "text-on-bubble-out/85" : "text-ink-muted"
                }`}
              >
                {message.replyTo.text}
              </span>
            </blockquote>
          )}
          <div
            className={`flex items-end gap-2 ${
              startsRun && !message.mine ? "mt-0.5" : ""
            }`}
          >
            {isDeleted ? (
              <p
                className={`min-w-0 text-sm leading-snug italic ${
                  message.mine ? "text-on-bubble-out/80" : "text-ink-muted"
                }`}
              >
                {DELETED_MESSAGE_TEXT}
              </p>
            ) : (
              message.text && (
                <p className="min-w-0 text-sm leading-snug break-words">
                  <MessageText
                    message={message}
                    currentUsername={currentUsername}
                  />
                </p>
              )
            )}
            <span
              className={`ml-auto flex shrink-0 items-center gap-1 text-3xs leading-none ${
                message.mine ? "text-on-bubble-out/75" : "text-ink-muted"
              }`}
            >
              {/* Beside the time rather than under the text, where every other
                  app puts it - and only for a real edit. `updated_at` cannot
                  answer this question, which is why the server has a column
                  that is null until somebody actually changes the words. */}
              {message.editedAt !== null && !isDeleted && (
                <span className="italic">edited</span>
              )}
              {message.time}
              {/* Ticks only on your own messages, and only where somebody could
                  report reading them. */}
              {message.mine &&
                readableCount > 0 &&
                (readers === 0 ? (
                  <Check className="h-3 w-3" aria-label="Sent" />
                ) : (
                  // Read by everyone is the full bubble ink against the
                  // softer time: a green tick vanished on the accent fill.
                  <CheckCheck
                    className={`h-3 w-3 ${
                      readers >= readableCount ? "text-on-bubble-out" : ""
                    }`}
                    aria-label={`Read by ${readers}`}
                  />
                ))}
            </span>
          </div>

          {!isDeleted && message.linkPreview && (
            <LinkPreviewCard
              preview={message.linkPreview}
              mine={message.mine}
            />
          )}

          {!isDeleted &&
            message.attachments &&
            message.attachments.length > 0 && (
              <div className="mt-2 space-y-1">
                {message.attachments.map((attachment) => {
                  const isImage = attachment.contentType?.startsWith("image/");
                  const isAudio = attachment.contentType?.startsWith("audio/");

                  return (
                    <div key={attachment.id ?? attachment.url}>
                      {isAudio && (
                        <audio
                          controls
                          src={attachment.url}
                          className="mb-1 max-w-full"
                        />
                      )}
                      {isImage && (
                        // The picture is the link now, so opening it full size
                        // does not need its filename printed underneath.
                        <a
                          href={attachment.url}
                          target="_blank"
                          rel="noreferrer"
                          aria-label={`Open ${attachment.originalName}`}
                          className="block"
                        >
                          <Image
                            src={attachment.url}
                            alt={attachment.originalName}
                            width={400}
                            height={224}
                            unoptimized
                            className="mb-1 max-h-56 max-w-full rounded-lg object-cover"
                          />
                        </a>
                      )}
                      {/* The name only where nothing else shows the attachment:
                          a document, or a video - which has no player yet. Under
                          an image or a voice note it was just clutter. */}
                      {!isImage && !isAudio && (
                        <a
                          href={attachment.url}
                          target="_blank"
                          rel="noreferrer"
                          className="block truncate text-xs underline"
                        >
                          {attachment.originalName}
                        </a>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          {/* INSIDE the article, on a row of its own. `absolute right-0
              -bottom-4` below is already claimed by the "N read" caption, and
              two things in that space overlap. */}
          {!isDeleted && (
            <MessageReactions
              reactions={message.reactions}
              currentUsername={currentUsername}
              busy={reactionBusy}
              onToggle={(emoji, reacted) =>
                onToggleReaction(message.id, emoji, reacted)
              }
            />
          )}
        </article>

        {!isDeleted && (
          <MessageActionsButton
            isMenuOpen={isMenuOpen}
            onOpen={openAt}
            sender={message.sender}
            // Outside the bubble on whichever side has room.
            side={message.mine ? "left" : "right"}
          />
        )}
      </div>

      {/* Spelled out once, under the newest message you sent - under every one
          it is noise, and the ticks already say it per message. */}
      {message.mine && isLastOwn && readers > 0 && (
        <span className="absolute right-0 -bottom-4 text-3xs whitespace-nowrap text-ink-muted">
          {readers} read {message.time}
        </span>
      )}
    </div>
  );
}

/**
 * The one always-available way in, for anyone not using a right-click.
 *
 * Absolutely positioned, so it takes no layout space and the bubble is exactly
 * the width it was before this component existed.
 *
 * `pointer-events-none` is paired with `opacity-0` deliberately. An
 * opacity-0 element is still hit-testable, and Tailwind compiles `group-hover`
 * under `@media (hover: hover)` - so on a touch device the reveal rule never
 * applies and, without this, every bubble carried an invisible tap target that
 * opened a menu with nothing visibly pressed.
 */
function MessageActionsButton({
  isMenuOpen,
  onOpen,
  sender,
  side,
}: {
  isMenuOpen: boolean;
  onOpen: (point: { x: number; y: number }) => void;
  sender: string;
  side: "left" | "right";
}) {
  return (
    <button
      type="button"
      // Exempt from the menu's click-outside, or the pointerdown that precedes
      // this button's own click would close the menu and the click would
      // immediately reopen it - so the trigger could never dismiss it.
      data-ignore-click-outside=""
      aria-label={`Actions for message from ${sender}`}
      aria-haspopup="menu"
      aria-expanded={isMenuOpen}
      onClick={(event) => {
        // A keyboard-triggered click reports clientX/clientY as 0, which put
        // the menu in the top-left corner of the viewport. Fall back to the
        // button's own position, which is where it belongs anyway.
        const fromPointer = event.clientX !== 0 || event.clientY !== 0;
        if (fromPointer) {
          onOpen({ x: event.clientX, y: event.clientY });
          return;
        }
        const box = event.currentTarget.getBoundingClientRect();
        onOpen({ x: box.right, y: box.bottom });
      }}
      className={`absolute top-1/2 -translate-y-1/2 rounded-full border border-line bg-canvas p-1.5 text-ink-muted shadow-sm transition hover:bg-hover hover:text-ink focus:opacity-100 focus-visible:ring-2 focus-visible:ring-focus focus-visible:outline-none ${
        side === "left" ? "right-full mr-1.5" : "left-full ml-1.5"
      } ${
        isMenuOpen
          ? "opacity-100"
          : "pointer-events-none opacity-0 focus-visible:pointer-events-auto group-hover/message:pointer-events-auto group-hover/message:opacity-100"
      }`}
    >
      <MoreHorizontal className="h-3.5 w-3.5" />
    </button>
  );
}

/**
 * The words, with the names it mentioned picked out.
 *
 * Matched against the mentions the SERVER stored rather than by looking for
 * "@" in the text, so a message that says "email me @ noon" highlights
 * nothing. Your own name is picked out harder than everybody else's, which is
 * the whole point of the highlight in a busy Loop.
 */
function MessageText({
  message,
  currentUsername,
}: {
  message: ThreadMessage;
  // Null, not just absent: the session helper answers null when nobody is
  // signed in, and the bubble passes that straight through.
  currentUsername?: string | null;
}) {
  const segments = splitByMentions(
    message.text,
    message.mentions ?? [],
    message.mentionsEveryone ?? false,
    currentUsername,
  );

  return (
    <>
      {segments.map((segment, index) =>
        segment.isMention ? (
          <span
            key={index}
            className={
              segment.isMe
                ? "rounded bg-amber-100 px-0.5 font-semibold text-amber-900 dark:bg-amber-500/25 dark:text-amber-200"
                : // The accent would vanish on your own accent-filled bubble.
                  message.mine
                  ? "font-semibold underline"
                  : "font-semibold text-brand-ink"
            }
          >
            {segment.text}
          </span>
        ) : (
          <span key={index}>{segment.text}</span>
        ),
      )}
    </>
  );
}
