"use client";

import { Phone, PhoneOff, Video } from "lucide-react";
import { ChatAvatar } from "@/components/home/ChatAvatar";
import { useCalls } from "@/lib/calls/CallProvider";

/**
 * Somebody is calling.
 *
 * A card rather than a modal: it must not trap focus away from whatever the
 * person is typing, and it must be possible to ignore. It goes away on its
 * own when the call is answered elsewhere, declined elsewhere, or ends.
 */
export function IncomingCallPrompt() {
  const {
    incomingCall,
    activeCall,
    acceptIncomingCall,
    declineIncomingCall,
    conversationFor,
  } = useCalls();

  if (!incomingCall) return null;

  const conversation = conversationFor(incomingCall);
  const caller = incomingCall.createdBy;
  const callerName = caller?.name ?? "Someone";
  const isGroup = conversation?.kind === "group";
  const isVideo = incomingCall.type === "video";
  const kind = isVideo ? "video call" : "voice call";

  return (
    <div
      role="alertdialog"
      aria-live="assertive"
      aria-label={`Incoming ${kind} from ${callerName}`}
      className="fixed top-4 left-1/2 z-[60] w-[min(26rem,calc(100vw-2rem))] -translate-x-1/2 rounded-2xl bg-slate-900 p-4 text-white shadow-2xl ring-1 ring-white/10"
    >
      <div className="flex items-center gap-3">
        <span className="relative">
          <span
            aria-hidden
            className="absolute inset-0 animate-ping rounded-full bg-emerald-400/40"
          />
          <ChatAvatar
            name={isGroup ? (conversation?.name ?? callerName) : callerName}
            imageUrl={
              isGroup
                ? (conversation?.logoImage ?? null)
                : (caller?.avatarUrl ?? null)
            }
            isGroup={isGroup}
            size={48}
            className="relative"
          />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">
            {isGroup ? conversation?.name : callerName}
          </p>
          <p className="truncate text-sm text-slate-400">
            {isGroup ? `${callerName} started a ${kind}` : `Incoming ${kind}`}
          </p>
        </div>
      </div>

      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={declineIncomingCall}
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-rose-600 px-3 py-2.5 text-sm font-semibold hover:bg-rose-700"
        >
          <PhoneOff className="h-4 w-4" />
          Decline
        </button>
        <button
          type="button"
          onClick={() => void acceptIncomingCall()}
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-3 py-2.5 text-sm font-semibold hover:bg-emerald-700"
        >
          {isVideo ? (
            <Video className="h-4 w-4" />
          ) : (
            <Phone className="h-4 w-4" />
          )}
          {/* Accepting leaves the call you are in; say so before, not after. */}
          {activeCall ? "Leave & answer" : isGroup ? "Join" : "Answer"}
        </button>
      </div>
    </div>
  );
}
