"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronRight, ExternalLink, Inbox } from "lucide-react";
import { NavDrawerButton } from "@/components/app/NavDrawerButton";
import {
  dayBucket,
  presentNotification,
  timeLabel,
} from "@/components/app/activityCopy";
import { useAppShell } from "@/lib/app/AppShellProvider";
import {
  fetchNotifications,
  markNotificationsRead,
  type AppNotification,
} from "@/lib/chat/notifications";

const FILTERS = [
  { id: "all", label: "All" },
  { id: "unread", label: "Unread" },
  { id: "groups", label: "Groups" },
  { id: "invites", label: "Invites" },
  { id: "account", label: "Account" },
  { id: "sms", label: "SMS" },
] as const;

type FilterId = (typeof FILTERS)[number]["id"];

export default function ActivityPage() {
  const router = useRouter();
  const { activityUnread, setActivityUnread, activityVersion } = useAppShell();
  const [filter, setFilter] = useState<FilterId>("all");
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // activityVersion changes when a notification arrives on the socket, which
  // is what refetches the open feed without polling it.
  useEffect(() => {
    let cancelled = false;

    fetchNotifications({
      category: filter === "unread" || filter === "all" ? undefined : filter,
      unreadOnly: filter === "unread",
    }).then((result) => {
      if (cancelled) return;
      setIsLoading(false);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setError(null);
      setNotifications(result.page.notifications);
      setActivityUnread(result.page.unreadCount);
    });

    return () => {
      cancelled = true;
    };
  }, [filter, activityVersion, setActivityUnread]);

  const selected = useMemo(
    () => notifications.find((row) => row.id === selectedId) ?? null,
    [notifications, selectedId],
  );

  const openNotification = useCallback(
    (notification: AppNotification) => {
      setSelectedId(notification.id);
      if (notification.readAt) return;

      // Optimistic: the row stops looking new the moment it is opened, and the
      // request behind it only corrects the count if it fails.
      setNotifications((rows) =>
        rows.map((row) =>
          row.id === notification.id
            ? { ...row, readAt: new Date().toISOString() }
            : row,
        ),
      );
      setActivityUnread(Math.max(0, activityUnread - 1));
      void markNotificationsRead([notification.id]);
    },
    [activityUnread, setActivityUnread],
  );

  const markAllRead = useCallback(async () => {
    const stamp = new Date().toISOString();
    setNotifications((rows) =>
      rows.map((row) => (row.readAt ? row : { ...row, readAt: stamp })),
    );
    setActivityUnread(0);
    const result = await markNotificationsRead();
    if (result.ok) setActivityUnread(result.unreadCount);
  }, [setActivityUnread]);

  // Grouped in render order, so the headings follow the sort rather than a
  // second opinion about it.
  const groups = useMemo(() => {
    const buckets: { bucket: string; rows: AppNotification[] }[] = [];
    for (const row of notifications) {
      const bucket = dayBucket(row.createdAt);
      const last = buckets[buckets.length - 1];
      if (last && last.bucket === bucket) last.rows.push(row);
      else buckets.push({ bucket, rows: [row] });
    }
    return buckets;
  }, [notifications]);

  return (
    <div className="grid h-full min-h-0 w-full overflow-hidden md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:grid-cols-[420px_1fr]">
      <section className="flex min-h-0 flex-col border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <header className="border-b border-slate-200 px-4 py-4 dark:border-slate-800">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-1">
              <NavDrawerButton className="-ml-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300" />
              <div className="min-w-0">
                <h1 className="truncate text-xl font-bold text-slate-900 dark:text-slate-100">
                  Activity
                </h1>
                <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">
                  Notifications about your groups and account
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => void markAllRead()}
              disabled={activityUnread === 0}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-sky-700 transition hover:bg-sky-50 disabled:opacity-40 dark:text-sky-300 dark:hover:bg-sky-950/40"
            >
              <Check className="h-4 w-4" />
              Mark all as read
            </button>
          </div>

          <div className="mt-3 flex flex-wrap gap-1.5">
            {FILTERS.map((option) => {
              const active = filter === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => {
                    if (option.id === filter) return;
                    setIsLoading(true);
                    setFilter(option.id);
                  }}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition ${
                    active
                      ? "bg-[#168CFF] text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                  }`}
                >
                  {option.label}
                  {option.id === "unread" && activityUnread > 0 && (
                    <span
                      className={`rounded-full px-1.5 text-[10px] font-bold ${
                        active
                          ? "bg-white/25 text-white"
                          : "bg-[#168CFF] text-white"
                      }`}
                    >
                      {activityUnread}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
          {isLoading && notifications.length === 0 ? (
            <p className="px-1 py-6 text-center text-xs text-slate-500 dark:text-slate-400">
              Loading activity...
            </p>
          ) : error ? (
            <p className="rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:bg-rose-950/30 dark:text-rose-300">
              {error}
            </p>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-4 py-16 text-center">
              <Inbox className="h-8 w-8 text-slate-300 dark:text-slate-600" />
              <p className="mt-3 text-sm font-semibold text-slate-900 dark:text-slate-100">
                Nothing here yet
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Join requests, invitations and group changes show up here.
              </p>
            </div>
          ) : (
            groups.map((group) => (
              <div key={group.bucket} className="mb-4">
                <p className="mb-2 px-1 text-[11px] font-bold tracking-[0.1em] text-slate-400 uppercase dark:text-slate-500">
                  {group.bucket}
                </p>
                <div className="space-y-2">
                  {group.rows.map((row) => (
                    <ActivityRow
                      key={row.id}
                      notification={row}
                      isOpen={row.id === selectedId}
                      onOpen={() => openNotification(row)}
                    />
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="hidden min-h-0 flex-col overflow-y-auto bg-[#f7fbff] md:flex dark:bg-slate-950">
        {selected ? (
          <ActivityDetail
            notification={selected}
            onOpenGroup={() => {
              if (selected.conversationId) router.push("/chats/");
            }}
          />
        ) : (
          <div className="flex h-full items-center justify-center p-8 text-center">
            <p className="max-w-xs text-sm text-slate-500 dark:text-slate-400">
              Select something on the left to see the detail.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}

function ActivityRow({
  notification,
  isOpen,
  onOpen,
}: {
  notification: AppNotification;
  isOpen: boolean;
  onOpen: () => void;
}) {
  const { title, detail, icon: Icon, tone } = presentNotification(notification);
  const isUnread = notification.readAt === null;
  const bucket = dayBucket(notification.createdAt);

  // Same four states as the chat list, for the same reason: unread and open
  // are independent, and a row can be either or both.
  const rowTone = isOpen
    ? isUnread
      ? "border-sky-400 bg-[#DDF0FF] dark:border-sky-500 dark:bg-sky-900/50"
      : "border-sky-400 bg-[#E4F3FF] dark:border-sky-500 dark:bg-sky-900/40"
    : isUnread
      ? "border-transparent bg-[#F2F8FF] hover:bg-[#F7FAFC] dark:bg-sky-950/40 dark:hover:bg-slate-800"
      : "border-transparent bg-white hover:bg-[#F7FAFC] dark:bg-slate-800 dark:hover:bg-slate-700";

  return (
    <button
      type="button"
      onClick={onOpen}
      className={`flex w-full items-start gap-3 rounded-xl border p-3 text-left transition ${rowTone}`}
    >
      <span
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${tone}`}
      >
        <Icon className="h-4.5 w-4.5" />
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-2">
          <span
            className={`truncate text-sm text-slate-900 dark:text-slate-100 ${
              isUnread ? "font-bold" : "font-semibold"
            }`}
          >
            {title}
          </span>
          <span className="shrink-0 text-[11px] text-slate-400 dark:text-slate-500">
            {timeLabel(notification.createdAt, bucket)}
          </span>
        </span>

        {notification.conversationName && (
          <span className="mt-0.5 block truncate text-xs text-slate-500 dark:text-slate-400">
            {notification.conversationName}
          </span>
        )}
        {detail && (
          <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">
            {detail}
          </span>
        )}
      </span>

      <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-slate-300 dark:text-slate-600" />
    </button>
  );
}

function ActivityDetail({
  notification,
  onOpenGroup,
}: {
  notification: AppNotification;
  onOpenGroup: () => void;
}) {
  const { title, detail, icon: Icon, tone } = presentNotification(notification);
  const bucket = dayBucket(notification.createdAt);

  return (
    <div className="p-6">
      <div className="flex items-start justify-between gap-4">
        <span
          className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full ${tone}`}
        >
          <Icon className="h-6 w-6" />
        </span>

        {notification.conversationId && (
          <button
            type="button"
            onClick={onOpenGroup}
            className="inline-flex items-center gap-2 rounded-xl bg-[#168CFF] px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
          >
            Open group
            <ExternalLink className="h-4 w-4" />
          </button>
        )}
      </div>

      <h2 className="mt-4 text-xl font-bold text-slate-900 dark:text-slate-100">
        {title}
      </h2>
      {notification.conversationName && (
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
          {notification.conversationName}
        </p>
      )}
      <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
        {bucket === "Earlier"
          ? new Date(notification.createdAt).toLocaleString()
          : timeLabel(notification.createdAt, bucket)}
      </p>

      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
        <p className="text-sm text-slate-700 dark:text-slate-200">
          {detail ?? title}
        </p>

        <dl className="mt-4 space-y-2 text-sm">
          {notification.actorName && (
            <div className="flex gap-3">
              <dt className="w-28 shrink-0 text-slate-500 dark:text-slate-400">
                Person
              </dt>
              <dd className="text-slate-800 dark:text-slate-200">
                {notification.actorName}
              </dd>
            </div>
          )}
          {notification.conversationName && (
            <div className="flex gap-3">
              <dt className="w-28 shrink-0 text-slate-500 dark:text-slate-400">
                Group
              </dt>
              <dd className="text-slate-800 dark:text-slate-200">
                {notification.conversationName}
              </dd>
            </div>
          )}
          <div className="flex gap-3">
            <dt className="w-28 shrink-0 text-slate-500 dark:text-slate-400">
              When
            </dt>
            <dd className="text-slate-800 dark:text-slate-200">
              {new Date(notification.createdAt).toLocaleString()}
            </dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
