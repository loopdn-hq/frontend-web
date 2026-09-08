"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { presentNotification } from "@/components/app/activityCopy";
import { useAppShell } from "@/lib/app/AppShellProvider";
import {
  normalizeNotification,
  type AppNotification,
} from "@/lib/chat/notifications";

const VISIBLE_FOR_MS = 6000;
// Two at a time. A stack that grows without limit covers the app it is
// reporting on, which is worse than missing one - they are all in Activity.
const MAX_STACKED = 2;

/**
 * Transient notices for activity arriving while you are looking elsewhere.
 *
 * Mounted in the app layout rather than on the Activity page, since the whole
 * point is being somewhere else when it happens.
 */
export function ActivityToasts() {
  const router = useRouter();
  const { subscribeToSocket } = useAppShell();
  const [toasts, setToasts] = useState<AppNotification[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((row) => row.id !== id));
  }, []);

  useEffect(
    () =>
      subscribeToSocket((frame) => {
        if (frame.type !== "notification.new") return;
        const row = normalizeNotification(frame.notification);
        if (!row) return;
        setToasts((current) =>
          [...current.filter((existing) => existing.id !== row.id), row].slice(
            -MAX_STACKED,
          ),
        );
      }),
    [subscribeToSocket],
  );

  // One timer per toast, cleared together whenever the stack changes.
  useEffect(() => {
    if (toasts.length === 0) return;
    const timers = toasts.map((row) =>
      window.setTimeout(() => dismiss(row.id), VISIBLE_FOR_MS),
    );
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [toasts, dismiss]);

  if (toasts.length === 0) return null;

  return (
    <div className="pointer-events-none fixed right-4 bottom-4 z-50 flex w-[min(22rem,calc(100vw-2rem))] flex-col gap-2">
      {toasts.map((row) => {
        const { title, icon: Icon, tone } = presentNotification(row);
        return (
          <div
            key={row.id}
            className="pointer-events-auto flex items-start gap-3 rounded-2xl bg-slate-900 p-3 text-white shadow-[0_12px_30px_rgba(15,23,42,0.35)]"
          >
            <button
              type="button"
              onClick={() => {
                dismiss(row.id);
                router.push("/activity/");
              }}
              className="flex min-w-0 flex-1 items-start gap-3 text-left"
            >
              <span
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${tone}`}
              >
                <Icon className="h-4 w-4" />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold">
                  {title}
                </span>
                {row.conversationName && (
                  <span className="block truncate text-xs text-slate-400">
                    {row.conversationName}
                  </span>
                )}
              </span>
            </button>

            <button
              type="button"
              onClick={() => dismiss(row.id)}
              aria-label="Dismiss"
              className="shrink-0 rounded-lg p-1 text-slate-400 transition hover:bg-white/10 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
