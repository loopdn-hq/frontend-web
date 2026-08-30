"use client";

type CommunicationMode = "chat" | "broadcast";
type BroadcastReplyMode = "private" | "group_wide" | "disabled";

type Message = {
  id: number;
  sender: string;
  text: string;
  mine: boolean;
  time: string;
  type?: "message" | "announcement";
  replyMode?: BroadcastReplyMode;
};

type LoopMessagingInterfaceProps = {
  messages: Message[];
  mode: CommunicationMode;
  onSendMessage?: (message: string) => Promise<void>;
  isLoading?: boolean;
};

export function LoopMessagingInterface({
  messages,
  mode,
  onSendMessage,
  isLoading = false,
}: LoopMessagingInterfaceProps) {
  return (
    <div className="flex flex-col">
      {/* Messages Section */}
      <div className="flex-1 space-y-4 overflow-y-auto px-5 py-6">
        {messages.map((message) => (
          <article
            key={message.id}
            className={`max-w-xl rounded-2xl px-4 py-3 ${
              message.mine
                ? "ml-auto bg-sky-600 text-white"
                : "bg-white text-slate-800 shadow-[0_4px_16px_rgba(26,85,133,0.08)]"
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p
                  className={`text-xs ${message.mine ? "text-sky-100" : "text-slate-500"}`}
                >
                  {message.sender}
                </p>
                {message.type === "announcement" && !message.mine && (
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-600">
                    📢 Announcement
                  </p>
                )}
              </div>
            </div>
            <p className="mt-1 text-sm leading-relaxed">{message.text}</p>
            <p
              className={`mt-2 text-[11px] ${message.mine ? "text-sky-100" : "text-slate-400"}`}
            >
              {message.time}
            </p>

            {/* Broadcast Reply Info */}
            {message.type === "announcement" &&
              !message.mine &&
              mode === "broadcast" && (
                <div className="mt-2 border-t border-slate-200 pt-2">
                  <p className="text-[11px] text-slate-600">
                    {message.replyMode === "private" &&
                      "💬 Reply privately to admins"}
                    {message.replyMode === "group_wide" &&
                      "💬 Reply to everyone"}
                    {message.replyMode === "disabled" &&
                      "❌ No replies allowed"}
                  </p>
                </div>
              )}
          </article>
        ))}
      </div>

      {/* Input Area */}
      <footer className="border-t border-sky-100 p-4">
        {mode === "chat" ? (
          <ChatModeInput isLoading={isLoading} onSend={onSendMessage} />
        ) : (
          <BroadcastModeInput isLoading={isLoading} />
        )}
      </footer>
    </div>
  );
}

function ChatModeInput({
  isLoading,
  onSend,
}: {
  isLoading?: boolean;
  onSend?: (message: string) => Promise<void>;
}) {
  return (
    <div className="flex gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-[0_6px_20px_rgba(30,89,138,0.09)]">
      <input
        type="text"
        placeholder="Type your message..."
        className="w-full bg-transparent px-2 text-sm text-slate-700 outline-none placeholder:text-slate-400"
      />
      <button
        type="button"
        disabled={isLoading}
        className="rounded-xl bg-[linear-gradient(130deg,#02adff_0%,#297be3_100%)] px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Send
      </button>
    </div>
  );
}

function BroadcastModeInput({ isLoading }: { isLoading?: boolean }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs font-semibold text-slate-600">📢 BROADCAST MODE</p>
      <p className="mt-2 text-sm text-slate-700">
        In broadcast mode, use the admin dashboard to send announcements.
        Members can view and reply according to reply settings.
      </p>
      <button
        type="button"
        disabled={isLoading}
        className="mt-3 rounded-lg border border-sky-300 bg-white px-4 py-2 text-sm font-medium text-sky-700 transition hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Send Announcement
      </button>
    </div>
  );
}
