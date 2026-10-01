"use client";

import { Modal } from "@/components/ui/modal";
import { ChatAvatar } from "../ChatAvatar";
import { dayLabel } from "@/lib/chat/preview";
import type { ConversationParticipant } from "@/lib/chat/conversations";
import type { ThreadMessage } from "./MessageBubble";

/**
 * What is actually known about one message.
 *
 * DELIBERATELY INCOMPLETE, and the empty spaces are the point. The design asks
 * for per-channel delivery - App delivered/read, SMS delivered/failed, Email
 * delivered/opened - and only one of those can be answered honestly today:
 *
 *   READ      real. Participant.last_read_message is a per-member pointer the
 *             API already serializes, so "who has read this" is a fact.
 *   APP       there is no delivered state. The websocket send is unacknowledged
 *             by design - client_id exists precisely because there is no ack -
 *             so a "Delivered" row here would be decoration.
 *   SMS/EMAIL real records exist (SmsDelivery, EmailDelivery) but no endpoint
 *             exposes them, so the client cannot read them yet.
 *
 * The layout has a row per channel so those can be filled in when the data is
 * real. It shows nothing it cannot support.
 */

type MessageInfoModalProps = {
  message: ThreadMessage | null;
  participants: ConversationParticipant[];
  currentUsername: string | null;
  onClose: () => void;
};

const sourceLabel: Record<string, string> = {
  app: "Sent from the app",
  sms: "Arrived by SMS",
  email: "Arrived by email",
  whatsapp: "Arrived by WhatsApp",
  system: "System message",
};

export function MessageInfoModal({
  message,
  participants,
  currentUsername,
  onClose,
}: MessageInfoModalProps) {
  if (!message) return null;

  const numericId = Number(message.id);

  // Only members with an account can report reading. A phone-only member is
  // permanently absent from this list - SMS reports that a handset took a
  // text, never that a person read it.
  //
  // The SENDER is excluded too, and not just when the sender is the viewer:
  // nobody reads their own message, so listing them among the readers would
  // inflate the count on every message somebody else sent.
  const readable = participants.filter(
    (participant) =>
      participant.userId &&
      participant.username !== currentUsername &&
      participant.username !== message.senderUsername,
  );
  const readBy = Number.isFinite(numericId)
    ? readable.filter(
        (participant) => (participant.lastReadMessageId ?? 0) >= numericId,
      )
    : [];

  const sentAt = message.createdAt ? new Date(message.createdAt) : null;

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="Message info"
      maxWidthClassName="max-w-lg"
      closeLabel="Close message info"
    >
      <div className="space-y-5">
        <section className="flex items-start gap-3">
          <ChatAvatar
            name={message.sender}
            imageUrl={message.senderAvatarUrl}
            size={40}
          />
          <div className="min-w-0">
            <p className="font-semibold text-slate-900 dark:text-slate-100">
              {message.sender}
            </p>
            {message.text && (
              <p className="mt-1 text-sm break-words text-slate-600 dark:text-slate-400">
                {message.text}
              </p>
            )}
          </div>
        </section>

        <dl className="space-y-2 border-t border-slate-100 pt-4 text-sm dark:border-slate-700">
          <Row label="Sent">
            {sentAt
              ? `${dayLabel(message.createdAt)} at ${sentAt.toLocaleTimeString(
                  [],
                  {
                    hour: "2-digit",
                    minute: "2-digit",
                  },
                )}`
              : "Unknown"}
          </Row>
          <Row label="Channel">
            {sourceLabel[message.source ?? "app"] ?? "Sent from the app"}
          </Row>
          {message.editedAt && (
            <Row label="Edited">
              {`${dayLabel(message.editedAt)} at ${new Date(
                message.editedAt,
              ).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}`}
            </Row>
          )}
          {message.forwarded && (
            // Never who from - a forward crosses conversations, and naming the
            // original sender would tell this room about somebody in a room it
            // cannot see.
            <Row label="Origin">Forwarded from another Loop</Row>
          )}
          {message.attachments && message.attachments.length > 0 && (
            <Row label="Attachments">
              {message.attachments.length === 1
                ? "1 file"
                : `${message.attachments.length} files`}
            </Row>
          )}
        </dl>

        <section className="border-t border-slate-100 pt-4 dark:border-slate-700">
          <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">
            Read by
          </p>
          {readable.length === 0 ? (
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              Nobody here can report reading a message. Members reached only by
              text are not counted — SMS confirms a handset took the message,
              never that a person read it.
            </p>
          ) : readBy.length === 0 ? (
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              Not read yet.
            </p>
          ) : (
            <ul className="mt-2 space-y-2">
              {readBy.map((participant) => (
                <li
                  key={participant.id}
                  className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200"
                >
                  <ChatAvatar
                    name={participant.name}
                    imageUrl={participant.avatarUrl}
                    size={24}
                  />
                  <span className="truncate">{participant.name}</span>
                </li>
              ))}
            </ul>
          )}
          {readable.length > 0 && (
            <p className="mt-3 text-xs text-slate-400 dark:text-slate-500">
              {readBy.length} of {readable.length}
            </p>
          )}
        </section>
      </div>
    </Modal>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="shrink-0 text-slate-500 dark:text-slate-400">{label}</dt>
      <dd className="min-w-0 truncate text-right text-slate-800 dark:text-slate-200">
        {children}
      </dd>
    </div>
  );
}
