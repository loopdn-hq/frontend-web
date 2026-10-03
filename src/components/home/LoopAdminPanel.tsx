"use client";

/**
 * One Loop's panel: its settings on the left, the chosen screen on the right.
 *
 * Built on the shared Modal rather than its own overlay. Hand-rolled, this had
 * an Escape listener and none of the rest - no click-outside, no scroll lock
 * behind it, no focus return, no accessible name - and the user settings dialog
 * had already been moved onto Modal for exactly those reasons. The rail is the
 * same shape as that dialog's.
 *
 * Two screens today, General and Members. Permissions, Features, Invite and
 * Safety are named in the design but not built: a rail entry that does nothing
 * is worse than one that is not there yet, so they are left out rather than
 * shown greyed. General already holds the permissions and feature switches.
 */
import { useEffect, useEffectEvent, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { LogOut, MessageCircle, Settings, Users } from "lucide-react";
import { Alert, Button, Modal } from "@/components/ui";
import { SettingsHeading } from "@/components/settings/SettingsRows";
import { GroupWhatsAppPanel } from "@/components/whatsapp/GroupWhatsAppPanel";
import { LoopPanelGeneral } from "./LoopPanelGeneral";
import type { LoopDetailsChange } from "./LoopDetailsForm";
import { LoopPanelMembers } from "./LoopPanelMembers";
import type {
  ConversationParticipant,
  GroupNumber,
  GroupSettings,
} from "@/lib/chat/conversations";

export type AdminTab = "general" | "members" | "whatsapp";

type MemberRole = "admin" | "member";

type PendingRequest = {
  id: string;
  name: string;
  username?: string;
  phone?: string;
};

const RAIL: { value: AdminTab; label: string; icon: LucideIcon }[] = [
  { value: "general", label: "General", icon: Settings },
  { value: "members", label: "Members", icon: Users },
  { value: "whatsapp", label: "WhatsApp", icon: MessageCircle },
];

type LoopAdminPanelProps = {
  isOpen: boolean;
  /** Which group this is, for the WhatsApp tab's own requests. */
  conversationId?: string | number | null;
  onClose: () => void;
  loopName: string;
  loopDescription?: string;
  loopImageUrl?: string | null;
  settings: GroupSettings | null;
  /** This Loop's own phone number, shown on General. Null until it has one. */
  smsNumber?: GroupNumber | null;
  isSettingsLoading?: boolean;
  /** The policy settings on General. Admins only, whatever the group says. */
  canEditSettings?: boolean;
  /** The photo, name and description, which a group can open to members. */
  canEditDetails?: boolean;
  canModerateMembers?: boolean;
  activeTab: AdminTab;
  onTabChange: (tab: AdminTab) => void;
  members: ConversationParticipant[];
  viewerUsername?: string | null;
  pendingRequests?: PendingRequest[];
  isPendingRequestsLoading?: boolean;
  onApproveRequest?: (participantId: string) => Promise<void>;
  onDeclineRequest?: (participantId: string) => Promise<void>;
  onSaveSettings?: (settings: Partial<GroupSettings>) => Promise<void>;
  onSaveDetails?: (change: LoopDetailsChange) => Promise<void>;
  onFetchJoinCode?: () => Promise<string>;
  /** Buys the Loop its number. Absent for anybody who may not. */
  onProvisionNumber?: () => Promise<void>;
  onAddMembers?: () => void;
  /** Opens "Invite by WhatsApp" from the Members tab. */
  onInviteByWhatsApp?: () => void;
  onUpdateMemberRole?: (memberId: string, newRole: MemberRole) => Promise<void>;
  onBlockMember?: (memberId: string) => Promise<void>;
  onNudgeMember?: (memberId: string, channel: string) => Promise<void>;
  onRemoveMember?: (memberId: string) => Promise<void>;
  /**
   * Who is blocked from this group. Passed only to somebody who may manage
   * members, so its absence is what hides the blocked count and list.
   */
  onFetchBlockedMembers?: () => Promise<ConversationParticipant[]>;
  onUnblockMember?: (participantId: string) => Promise<void>;
  isLoading?: boolean;
  onLeaveLoop?: () => Promise<{ ok: true } | { ok: false; message: string }>;
};

export function LoopAdminPanel({
  isOpen,
  conversationId,
  onClose,
  loopName,
  loopDescription = "",
  loopImageUrl = null,
  settings,
  smsNumber = null,
  isSettingsLoading = false,
  canEditSettings = true,
  canEditDetails = canEditSettings,
  canModerateMembers = false,
  activeTab,
  onTabChange,
  members,
  viewerUsername,
  pendingRequests = [],
  isPendingRequestsLoading = false,
  onApproveRequest,
  onDeclineRequest,
  onSaveSettings,
  onSaveDetails,
  onFetchJoinCode,
  onProvisionNumber,
  onAddMembers,
  onInviteByWhatsApp,
  onUpdateMemberRole,
  onBlockMember,
  onNudgeMember,
  onRemoveMember,
  onFetchBlockedMembers,
  onUnblockMember,
  isLoading = false,
  onLeaveLoop,
}: LoopAdminPanelProps) {
  // The two views that open over a screen rather than beside it, reached from
  // the "Pending requests" and "Blocked members" rows on Members.
  const [isRequestsOpen, setIsRequestsOpen] = useState(false);
  const [isBlockedOpen, setIsBlockedOpen] = useState(false);
  // Null until the first answer, so Members shows a dash rather than claiming
  // nobody is blocked while it is still asking.
  const [blocked, setBlocked] = useState<ConversationParticipant[] | null>(
    null,
  );
  const [blockedError, setBlockedError] = useState("");

  function showBlocked(rows: ConversationParticipant[]) {
    setBlocked(rows);
    setBlockedError("");
  }

  function showBlockedError(err: unknown) {
    setBlockedError(
      err instanceof Error && err.message
        ? err.message
        : "Could not load blocked members.",
    );
  }

  /** Re-read after a block or an unblock, so the count never lags. */
  async function refreshBlocked() {
    if (!onFetchBlockedMembers) return;
    try {
      showBlocked(await onFetchBlockedMembers());
    } catch (err) {
      showBlockedError(err);
    }
  }

  // Read whenever Members is shown, so the count is current each time an
  // admin looks. An effect event because the fetcher is a new function on
  // every render of HomeShell, and depending on it would refetch on each one.
  const fetchBlocked = useEffectEvent(() => onFetchBlockedMembers?.());
  useEffect(() => {
    if (!isOpen || activeTab !== "members") return;
    // Dropped if the panel closes first, rather than landing on a screen
    // that is no longer there.
    let cancelled = false;
    fetchBlocked()?.then(
      (rows) => {
        if (!cancelled) showBlocked(rows);
      },
      (err: unknown) => {
        if (!cancelled) showBlockedError(err);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [isOpen, activeTab]);
  const [isLeaveOpen, setIsLeaveOpen] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);
  const [leaveError, setLeaveError] = useState("");

  function showTab(tab: AdminTab) {
    setIsRequestsOpen(false);
    setIsBlockedOpen(false);
    onTabChange(tab);
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`${loopName} Panel`}
      description="Manage your Loop settings and members."
      closeLabel="Close Loop panel"
      maxWidthClassName="max-w-5xl"
      // The rail draws its own edges and the pane its own padding; Modal's
      // would inset both away from them.
      bodyClassName="p-0"
    >
      <div className="flex flex-col sm:flex-row">
        <div
          role="tablist"
          aria-orientation="vertical"
          aria-label="Loop settings sections"
          className="flex shrink-0 gap-1 overflow-x-auto border-b border-slate-100 p-3 sm:w-48 sm:flex-col sm:overflow-x-visible sm:border-r sm:border-b-0 dark:border-slate-800"
        >
          {RAIL.map(({ value, label, icon: Icon }) => {
            const active = value === activeTab;
            return (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => showTab(value)}
                className={`flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-medium transition ${
                  active
                    ? "bg-sky-50 text-sky-700 dark:bg-slate-800 dark:text-sky-300"
                    : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="min-w-0 flex-1 truncate">{label}</span>
              </button>
            );
          })}

          {/* Kept where it has always been reachable from - the panel - rather
              than dropped because the design has no place for it yet. */}
          {onLeaveLoop && (
            <button
              type="button"
              onClick={() => {
                setLeaveError("");
                setIsLeaveOpen(true);
              }}
              className="mt-auto flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-medium text-slate-500 transition hover:bg-rose-50 hover:text-rose-600 dark:text-slate-400 dark:hover:bg-rose-950/30 dark:hover:text-rose-400"
            >
              <LogOut className="h-4 w-4 shrink-0" />
              Leave Loop
            </button>
          )}
        </div>

        <div
          role="tabpanel"
          className="max-h-[65vh] min-w-0 flex-1 overflow-y-auto p-5"
        >
          {isRequestsOpen ? (
            <JoinRequests
              requests={pendingRequests}
              isLoading={isPendingRequestsLoading}
              isBusy={isLoading}
              onApprove={onApproveRequest}
              onDecline={onDeclineRequest}
              onBack={() => setIsRequestsOpen(false)}
            />
          ) : isBlockedOpen ? (
            <BlockedMembers
              members={blocked}
              loadError={blockedError}
              onUnblock={async (participantId) => {
                await onUnblockMember?.(participantId);
                await refreshBlocked();
              }}
              onBack={() => setIsBlockedOpen(false)}
            />
          ) : activeTab === "whatsapp" ? (
            conversationId ? (
              <GroupWhatsAppPanel conversationId={conversationId} />
            ) : null
          ) : activeTab === "general" ? (
            settings ? (
              <LoopPanelGeneral
                settings={settings}
                onSave={onSaveSettings}
                canEdit={canEditSettings}
                details={{
                  name: loopName,
                  description: loopDescription,
                  imageUrl: loopImageUrl,
                }}
                canEditDetails={canEditDetails}
                onSaveDetails={onSaveDetails}
                onFetchJoinCode={onFetchJoinCode}
                smsNumber={smsNumber}
                onProvisionNumber={onProvisionNumber}
              />
            ) : (
              <p className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">
                {isSettingsLoading
                  ? "Loading settings..."
                  : "Unable to load settings."}
              </p>
            )
          ) : (
            <LoopPanelMembers
              loopName={loopName}
              members={members}
              viewerUsername={viewerUsername}
              canModerate={canModerateMembers}
              isLoading={isLoading}
              pendingRequestCount={pendingRequests.length}
              onOpenPendingRequests={() => setIsRequestsOpen(true)}
              blockedCount={blocked?.length ?? null}
              onOpenBlocked={
                onFetchBlockedMembers ? () => setIsBlockedOpen(true) : undefined
              }
              onAddMembers={onAddMembers}
              onInviteByWhatsApp={onInviteByWhatsApp}
              onUpdateMemberRole={onUpdateMemberRole}
              onRemoveMember={onRemoveMember}
              // The blocked count moves with every block, so it is re-read
              // rather than left a step behind.
              onBlockMember={
                onBlockMember &&
                (async (memberId) => {
                  await onBlockMember(memberId);
                  await refreshBlocked();
                })
              }
              onNudgeMember={onNudgeMember}
            />
          )}
        </div>
      </div>

      {isLeaveOpen && (
        <Modal
          isOpen={isLeaveOpen}
          onClose={() => (isLeaving ? undefined : setIsLeaveOpen(false))}
          title={`Leave ${loopName}?`}
          description="You stop receiving it. Your messages stay in the group, and you would need to be added back or rejoin."
          maxWidthClassName="max-w-sm"
          closeLabel="Keep me in this Loop"
          footer={
            <div className="flex gap-3">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setIsLeaveOpen(false)}
                disabled={isLeaving}
                fullWidth
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="danger"
                onClick={async () => {
                  setIsLeaving(true);
                  setLeaveError("");
                  const result = await onLeaveLoop?.();
                  setIsLeaving(false);
                  // The server refuses the last admin, and says why - that
                  // message is more use than anything invented here.
                  if (result && !result.ok) {
                    setLeaveError(result.message);
                    return;
                  }
                  setIsLeaveOpen(false);
                }}
                aria-disabled={isLeaving}
                className="aria-disabled:opacity-60"
                fullWidth
              >
                {isLeaving ? "Leaving..." : "Leave Loop"}
              </Button>
            </div>
          }
        >
          {leaveError && <Alert variant="error">{leaveError}</Alert>}
        </Modal>
      )}
    </Modal>
  );
}

/**
 * Who is blocked from this Loop, and the way to let each of them back.
 *
 * Unblocking does not add anybody: it lifts the ban, and they come back the
 * usual way - an admin adds them, or they rejoin as the join mode allows. The
 * description says so, because "Unblock" alone reads as "put them back".
 */
function BlockedMembers({
  members,
  loadError,
  onUnblock,
  onBack,
}: {
  members: ConversationParticipant[] | null;
  loadError: string;
  onUnblock: (participantId: string) => Promise<void>;
  onBack: () => void;
}) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function unblock(participantId: string) {
    setBusyId(participantId);
    setError("");
    try {
      await onUnblock(participantId);
    } catch (err) {
      setError(
        err instanceof Error && err.message
          ? err.message
          : "Could not unblock them. Try again.",
      );
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-4">
      <SettingsHeading
        title="Blocked members"
        description="Unblocking lets them back in the usual way - they can be added again, or rejoin if the Loop allows it. They are not added back automatically."
        backLabel="Members"
        onBack={onBack}
      />

      {(error || loadError) && (
        <Alert variant="error">{error || loadError}</Alert>
      )}

      {members === null && !loadError && (
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Loading blocked members...
        </p>
      )}

      {members?.length === 0 && (
        <p className="rounded-2xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
          Nobody is blocked from this Loop.
        </p>
      )}

      <ul className="space-y-2">
        {members?.map((member) => (
          <li
            key={member.id}
            className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900"
          >
            <div className="min-w-0">
              <p className="truncate font-medium text-slate-900 dark:text-slate-100">
                {member.name}
              </p>
              {(member.username || member.phone) && (
                <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                  {member.username ? `@${member.username}` : member.phone}
                </p>
              )}
            </div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="shrink-0"
              disabled={busyId !== null}
              onClick={() => void unblock(member.id)}
            >
              {busyId === member.id ? "Unblocking..." : "Unblock"}
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Who has asked to join, and the two answers. Reached from Members. */
function JoinRequests({
  requests,
  isLoading,
  isBusy,
  onApprove,
  onDecline,
  onBack,
}: {
  requests: PendingRequest[];
  isLoading: boolean;
  isBusy: boolean;
  onApprove?: (participantId: string) => Promise<void>;
  onDecline?: (participantId: string) => Promise<void>;
  onBack: () => void;
}) {
  return (
    <div className="space-y-4">
      <SettingsHeading
        title="Pending requests"
        description="People who asked to join. Approving adds them as a member."
        backLabel="Members"
        onBack={onBack}
      />

      {isLoading && (
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Loading requests...
        </p>
      )}

      {!isLoading && requests.length === 0 && (
        <p className="rounded-2xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
          No pending requests to join this Loop.
        </p>
      )}

      <ul className="space-y-2">
        {requests.map((request) => (
          <li
            key={request.id}
            className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900"
          >
            <div className="min-w-0">
              <p className="truncate font-medium text-slate-900 dark:text-slate-100">
                {request.name}
              </p>
              {(request.username || request.phone) && (
                <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                  {request.username ? `@${request.username}` : request.phone}
                </p>
              )}
            </div>
            <div className="flex shrink-0 gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={isBusy}
                onClick={() => void onDecline?.(request.id)}
              >
                Decline
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={isBusy}
                onClick={() => void onApprove?.(request.id)}
              >
                Approve
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
