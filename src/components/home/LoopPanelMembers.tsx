"use client";

/**
 * Members: who is in this Loop, and what an admin can do about each of them.
 *
 * The member list the app already holds is ACTIVE rows only - that is what
 * `GET /conversations/<id>/participants/` returns, deliberately, since somebody
 * who left or was removed is not a member. So nothing in this list is ever a
 * blocked person: they have their own list, behind "Blocked members", which is
 * where an admin unblocks them.
 */
import { useMemo, useState } from "react";
import {
  Ban,
  Crown,
  EllipsisVertical,
  MessageCircle,
  Search,
  UserPlus,
  Users,
} from "lucide-react";
import {
  Button,
  ContextMenu,
  Input,
  Select,
  type ContextMenuItem,
  type ContextMenuOrigin,
} from "@/components/ui";
import { LinkRow } from "@/components/settings/SettingsRows";
import { MemberChannelConsent } from "./MemberChannelConsent";
import { ChatAvatar } from "./ChatAvatar";
import type { ConversationParticipant } from "@/lib/chat/conversations";

/**
 * The two roles that exist. There is no moderator: `Participant.Role` is admin
 * or member, and the role endpoint is a ChoiceField over exactly those - so a
 * "Make moderator" item was an action that could only ever come back 400.
 */
type MemberRole = "admin" | "member";

const FILTER_OPTIONS = [
  { value: "all", label: "All roles" },
  { value: "admin", label: "Admins" },
  { value: "member", label: "Members" },
];

const SORT_OPTIONS = [
  { value: "name-asc", label: "Name (A-Z)" },
  { value: "name-desc", label: "Name (Z-A)" },
  { value: "joined", label: "Recently joined" },
  { value: "role", label: "Role" },
];

const ROLE_RANK: Record<MemberRole, number> = {
  admin: 0,
  member: 1,
};

type LoopPanelMembersProps = {
  loopName: string;
  members: ConversationParticipant[];
  /** Who is looking, so their own row does not offer to remove themselves. */
  viewerUsername?: string | null;
  canModerate?: boolean;
  isLoading?: boolean;
  pendingRequestCount?: number;
  onOpenPendingRequests?: () => void;
  /**
   * How many are blocked, or null while that is not known yet. Admins only:
   * nobody else may see who is blocked, so for them it is never shown.
   */
  blockedCount?: number | null;
  onOpenBlocked?: () => void;
  onAddMembers?: () => void;
  /** Opens "Invite by WhatsApp". Absent when the deployment has no WhatsApp. */
  onInviteByWhatsApp?: () => void;
  onUpdateMemberRole?: (memberId: string, role: MemberRole) => Promise<void>;
  onRemoveMember?: (memberId: string) => Promise<void>;
  onBlockMember?: (memberId: string) => Promise<void>;
  onNudgeMember?: (memberId: string, channel: string) => Promise<void>;
};

export function LoopPanelMembers({
  loopName,
  members,
  viewerUsername,
  canModerate = false,
  isLoading = false,
  pendingRequestCount = 0,
  onOpenPendingRequests,
  blockedCount = null,
  onOpenBlocked,
  onAddMembers,
  onInviteByWhatsApp,
  onUpdateMemberRole,
  onRemoveMember,
  onBlockMember,
  onNudgeMember,
}: LoopPanelMembersProps) {
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [sort, setSort] = useState("name-asc");
  const [isTipDismissed, setIsTipDismissed] = useState(false);
  const [menuFor, setMenuFor] = useState<{
    member: ConversationParticipant;
    origin: ContextMenuOrigin;
  } | null>(null);
  const [busyMemberId, setBusyMemberId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const counts = useMemo(
    () => ({
      total: members.length,
      admins: members.filter((member) => member.role === "admin").length,
    }),
    [members],
  );

  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const matching = members.filter((member) => {
      if (roleFilter !== "all" && member.role !== roleFilter) return false;
      if (!needle) return true;
      return [member.name, member.username, member.email, member.phone]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(needle));
    });

    // A copy: sort() is in place, and the prop is the caller's array.
    return [...matching].sort((one, two) => {
      if (sort === "name-desc") return two.name.localeCompare(one.name);
      if (sort === "joined") return two.joinedAt.localeCompare(one.joinedAt);
      if (sort === "role") {
        const byRole = ROLE_RANK[one.role] - ROLE_RANK[two.role];
        if (byRole !== 0) return byRole;
      }
      return one.name.localeCompare(two.name);
    });
  }, [members, query, roleFilter, sort]);

  /**
   * Run one moderation action, keeping the row's spinner and any refusal.
   *
   * The action may return undefined - every handler here is optional, and
   * `onRemoveMember?.(id)` is undefined when the host passed none - so there
   * is nothing to await and nothing to report.
   */
  async function run(
    memberId: string,
    action: () => Promise<void> | undefined,
  ) {
    setMenuFor(null);
    setBusyMemberId(memberId);
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(
        err instanceof Error && err.message
          ? err.message
          : "That did not work. Try again.",
      );
    } finally {
      setBusyMemberId(null);
    }
  }

  function menuItems(member: ConversationParticipant): ContextMenuItem[] {
    const items: ContextMenuItem[] = [];
    const roles: MemberRole[] = ["admin", "member"];

    for (const role of roles) {
      if (role === member.role) continue;
      items.push({
        id: `role-${role}`,
        label: role === "member" ? "Make a member" : `Make ${role}`,
        onSelect: () =>
          void run(member.id, () => onUpdateMemberRole?.(member.id, role)),
      });
    }

    // One entry per channel the server says a nudge can go out on. Anybody who
    // answered, was never asked, or has nowhere to receive it is absent rather
    // than disabled: offering a button that cannot work is worse than not
    // offering it. Read from the server rather than from `status`, which
    // offered a member added by phone a nudge about email.
    for (const [channel, state] of Object.entries(member.channels)) {
      if (!state.canNudge) continue;
      items.push({
        id: `nudge-${channel}`,
        label: `Nudge about ${channel.toUpperCase()}`,
        description: "Asks again. Once a day at most.",
        onSelect: () =>
          void run(member.id, () => onNudgeMember?.(member.id, channel)),
      });
    }

    items.push({ kind: "separator", id: "sep" });
    items.push({
      id: "remove",
      label: "Remove from Loop",
      description: "They can be added back.",
      tone: "danger",
      onSelect: () => void run(member.id, () => onRemoveMember?.(member.id)),
    });
    items.push({
      id: "block",
      label: "Block from Loop",
      description: "They cannot come back by any route.",
      tone: "danger",
      onSelect: () => void run(member.id, () => onBlockMember?.(member.id)),
    });

    return items;
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">
            Members
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Manage members of {loopName}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {onInviteByWhatsApp && (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={onInviteByWhatsApp}
            >
              <MessageCircle className="mr-1.5 h-4 w-4 text-emerald-600" />
              Invite by WhatsApp
            </Button>
          )}
          {onAddMembers && (
            <Button type="button" size="sm" onClick={onAddMembers}>
              <UserPlus className="mr-1.5 h-4 w-4" />
              Add members
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard icon={Users} value={counts.total} label="Total members" />
        <StatCard
          icon={Crown}
          value={counts.admins}
          label="Admins"
          tone="amber"
        />
        {/* A dash, not a zero, until the list arrives - zero would be a claim.
            Admins only, because only they may see who is blocked. */}
        {canModerate && (
          <StatCard
            icon={Ban}
            value={blockedCount ?? "-"}
            label="Blocked"
            tone="rose"
          />
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="relative min-w-0 flex-1">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400"
          />
          <Input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search members by name, email, or phone..."
            aria-label="Search members"
            className="py-2.5 pl-9"
          />
        </div>
        <Select
          value={roleFilter}
          options={FILTER_OPTIONS}
          onChange={(event) => setRoleFilter(event.target.value)}
          aria-label="Filter members by role"
          className="w-auto py-2.5"
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-base font-semibold text-slate-900 dark:text-slate-100">
          Members ({shown.length})
        </h4>
        <label className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
          Sort by
          <Select
            value={sort}
            options={SORT_OPTIONS}
            onChange={(event) => setSort(event.target.value)}
            className="w-auto py-2"
          />
        </label>
      </div>

      {error && (
        <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-950/30 dark:text-rose-300">
          {error}
        </p>
      )}

      {shown.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
          {isLoading
            ? "Loading members..."
            : members.length === 0
              ? "Nobody here yet."
              : "Nobody matches that."}
        </p>
      ) : (
        <ul className="space-y-2">
          {shown.map((member) => {
            const isSelf =
              !!member.username && member.username === viewerUsername;
            return (
              <li
                key={member.id}
                className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900"
              >
                <span className="relative shrink-0">
                  <ChatAvatar name={member.name} size={40} />
                  <span
                    aria-hidden="true"
                    className={`absolute -right-0.5 -bottom-0.5 h-3 w-3 rounded-full border-2 border-white dark:border-slate-900 ${
                      member.isOnline
                        ? "bg-emerald-500"
                        : "bg-slate-300 dark:bg-slate-600"
                    }`}
                  />
                </span>

                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-slate-900 dark:text-slate-100">
                    {member.name}
                    {isSelf && (
                      <span className="text-slate-400 dark:text-slate-500">
                        {" "}
                        (you)
                      </span>
                    )}
                  </p>
                  <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                    {member.email || member.phone || "No contact info"} · Joined{" "}
                    {joinedLabel(member.joinedAt)}
                  </p>
                  <MemberChannelConsent channels={member.channels} />
                </div>

                <RolePill role={member.role} />

                {/* Left out rather than disabled for anybody who cannot act,
                    and on your own row: the server refuses removing yourself -
                    leaving is the way out - so offering it would only produce a
                    refusal. */}
                {canModerate && !isSelf && (
                  <button
                    type="button"
                    data-ignore-click-outside
                    aria-label={`Manage ${member.name}`}
                    aria-haspopup="menu"
                    aria-busy={busyMemberId === member.id || undefined}
                    disabled={busyMemberId === member.id}
                    onClick={(event) => {
                      const trigger =
                        event.currentTarget.getBoundingClientRect();
                      setMenuFor({
                        member,
                        origin: { x: trigger.right, y: trigger.bottom },
                      });
                    }}
                    className="shrink-0 rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                  >
                    <EllipsisVertical className="h-4 w-4" />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {canModerate && !isTipDismissed && (
        <div className="flex items-start gap-3 rounded-2xl bg-sky-50 px-4 py-3 dark:bg-slate-800">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Managing members
            </p>
            <p className="text-xs leading-snug text-slate-600 dark:text-slate-400">
              You can change a member&apos;s role, remove them from the group,
              or block them if needed. Removing lets them be added back;
              blocking keeps them out until an admin unblocks them.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsTipDismissed(true)}
            aria-label="Dismiss"
            className="shrink-0 rounded-lg p-1 text-slate-400 hover:bg-white/60 hover:text-slate-700 dark:hover:bg-slate-700 dark:hover:text-slate-200"
          >
            <span aria-hidden="true">✕</span>
          </button>
        </div>
      )}

      <div className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 dark:divide-slate-800 dark:border-slate-700">
        {canModerate && (
          <LinkRow
            label="Blocked members"
            value={blockedCount ?? "-"}
            onClick={() => onOpenBlocked?.()}
            disabled={!onOpenBlocked}
          />
        )}
        <LinkRow
          label={`Pending requests (${pendingRequestCount})`}
          onClick={() => onOpenPendingRequests?.()}
          disabled={!onOpenPendingRequests}
        />
      </div>

      <ContextMenu
        origin={menuFor?.origin ?? null}
        onClose={() => setMenuFor(null)}
        label={menuFor?.member.name}
        items={menuFor ? menuItems(menuFor.member) : []}
      />
    </div>
  );
}

/**
 * "Sep 7, 2026" from whatever the row carries.
 *
 * `joined_at` is an ISO timestamp, except that the normaliser falls back to
 * "Recently" when it is missing - so anything unparseable is shown as it came
 * rather than as "Invalid Date".
 */
function joinedLabel(joinedAt: string): string {
  const when = new Date(joinedAt);
  if (Number.isNaN(when.getTime())) return joinedAt;
  return when.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function StatCard({
  icon: Icon,
  value,
  label,
  tone = "slate",
  title,
}: {
  icon: typeof Users;
  value: number | string;
  label: string;
  tone?: "slate" | "amber" | "rose";
  title?: string;
}) {
  const iconTone = {
    slate: "text-slate-500 dark:text-slate-400",
    amber: "text-amber-500",
    rose: "text-rose-500",
  }[tone];

  return (
    <div
      title={title}
      className="rounded-2xl border border-slate-200 bg-white p-3.5 dark:border-slate-700 dark:bg-slate-900"
    >
      <Icon aria-hidden="true" className={`h-5 w-5 ${iconTone}`} />
      <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-100">
        {value}
      </p>
      <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
    </div>
  );
}

function RolePill({ role }: { role: MemberRole }) {
  const tone = {
    admin:
      "bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300",
    member: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  }[role];

  return (
    <span
      className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${tone}`}
    >
      {role}
    </span>
  );
}
