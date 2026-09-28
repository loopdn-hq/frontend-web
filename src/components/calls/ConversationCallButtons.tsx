"use client";

import { Phone, Video } from "lucide-react";
import { useCalls } from "@/lib/calls/CallProvider";
import { currentStays } from "@/lib/calls/api";

type ConversationCallButtonsProps = {
  conversationId: string | number;
  /**
   * Whether this member may START a call here. The server's rule is the same
   * as for posting - in a broadcast group only admins - but anybody in the
   * conversation may JOIN one that is already going.
   */
  canStart: boolean;
};

const ICON_BUTTON =
  "rounded-lg border border-slate-200 bg-white p-2 text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white";

/** Voice and video buttons for a conversation's header, or Join / Return. */
export function ConversationCallButtons({
  conversationId,
  canStart,
}: ConversationCallButtonsProps) {
  const {
    phase,
    activeCall,
    liveCallsByConversation,
    startCall,
    joinCall,
    setMinimized,
  } = useCalls();

  const key = String(conversationId);
  const busy = phase === "starting" || phase === "joining";

  if (activeCall && String(activeCall.conversationId) === key) {
    return (
      <button
        type="button"
        onClick={() => setMinimized(false)}
        className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
      >
        <Phone className="h-4 w-4" />
        Return to call
      </button>
    );
  }

  const liveCall = liveCallsByConversation[key];
  if (liveCall) {
    const count = currentStays(liveCall).length;
    return (
      <button
        type="button"
        onClick={() => void joinCall(liveCall.id)}
        disabled={busy}
        title={`${count} ${count === 1 ? "person" : "people"} in the call`}
        className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
      >
        {liveCall.type === "video" ? (
          <Video className="h-4 w-4" />
        ) : (
          <Phone className="h-4 w-4" />
        )}
        Join call
        {count > 0 && <span className="opacity-80">({count})</span>}
      </button>
    );
  }

  if (!canStart) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => void startCall(conversationId, "audio")}
        disabled={busy}
        title="Voice call"
        aria-label="Start a voice call"
        className={ICON_BUTTON}
      >
        <Phone className="h-5 w-5" />
      </button>
      <button
        type="button"
        onClick={() => void startCall(conversationId, "video")}
        disabled={busy}
        title="Video call"
        aria-label="Start a video call"
        className={ICON_BUTTON}
      >
        <Video className="h-5 w-5" />
      </button>
    </>
  );
}
