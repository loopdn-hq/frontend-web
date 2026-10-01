"use client";

import { useCallback, useEffect, useState } from "react";
import { MessageCircle, RefreshCw, TriangleAlert } from "lucide-react";
import { Alert, Button, Input, Modal } from "@/components/ui";
import {
  disconnectConnection,
  fetchConnections,
  refreshConnection,
  updateConnectionTemplates,
} from "@/lib/whatsapp/api";
import { useWhatsAppConfig } from "@/lib/whatsapp/useWhatsAppConfig";
import { useWhatsAppConnect } from "@/lib/whatsapp/useWhatsAppConnect";
import type { WhatsAppConnection } from "@/lib/whatsapp/types";

/**
 * Settings → WhatsApp Business.
 *
 * One of exactly two places connecting is offered (the other is a group's
 * "Invite by WhatsApp"). It is never part of signing up or signing in: a
 * person can use the whole product without ever seeing Meta.
 */
export function WhatsAppSettingsSection() {
  const { config, isLoading: isLoadingConfig, isEnabled } = useWhatsAppConfig();
  const [connections, setConnections] = useState<WhatsAppConnection[] | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [confirmDisconnect, setConfirmDisconnect] =
    useState<WhatsAppConnection | null>(null);
  const [isDisconnecting, setIsDisconnecting] = useState(false);

  const {
    connect,
    isConnecting,
    error: connectError,
  } = useWhatsAppConnect({
    config,
  });

  // Not async, and every setState lives in the `.then`: an effect that sets
  // state in its own body cascades a second render before the first has
  // painted, which is what `react-hooks/set-state-in-effect` forbids. The
  // same shape as AppShellProvider's loadConversations, for the same reason.
  const load = useCallback(
    () =>
      fetchConnections().then((result) => {
        if (result.ok) {
          setConnections(result.data);
          setError(null);
        } else {
          setConnections([]);
          setError(result.message);
        }
      }),
    [],
  );

  useEffect(() => {
    if (!isEnabled) return;
    void load();
  }, [isEnabled, load]);

  const startConnect = useCallback(async () => {
    setNotice(null);
    const connection = await connect();
    if (!connection) return;
    setNotice(
      `${connection.verifiedName || "WhatsApp Business"} is connected.`,
    );
    await load();
  }, [connect, load]);

  const doRefresh = useCallback(async (connection: WhatsAppConnection) => {
    setBusyId(connection.id);
    setError(null);
    const result = await refreshConnection(connection.id);
    setBusyId(null);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setConnections((current) =>
      (current ?? []).map((row) =>
        row.id === result.data.id ? result.data : row,
      ),
    );
  }, []);

  const doDisconnect = useCallback(async () => {
    if (!confirmDisconnect) return;
    setIsDisconnecting(true);
    const result = await disconnectConnection(confirmDisconnect.id);
    setIsDisconnecting(false);
    setConfirmDisconnect(null);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setNotice("That number is disconnected.");
    await load();
  }, [confirmDisconnect, load]);

  // Nothing at all when the deployment has no WhatsApp: not a disabled
  // control, not an explanation - the feature simply is not here.
  if (isLoadingConfig || !isEnabled) return null;

  return (
    <section aria-labelledby="whatsapp-settings-title" className="space-y-4">
      <header>
        <h3
          id="whatsapp-settings-title"
          className="flex items-center gap-2 text-base font-semibold text-slate-900 dark:text-slate-100"
        >
          <MessageCircle className="h-4 w-4 text-emerald-600" />
          WhatsApp Business
        </h3>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Optional. Connect your own WhatsApp Business number and your groups
          can also reach members there. Messages send from your number and Meta
          bills you directly.
        </p>
      </header>

      {(error || connectError) && (
        <Alert variant="error">{connectError ?? error}</Alert>
      )}
      {notice && <Alert variant="success">{notice}</Alert>}

      {connections === null ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">Loading...</p>
      ) : connections.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 p-5 text-center dark:border-slate-700">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            No WhatsApp number is connected yet.
          </p>
          <Button
            className="mt-3"
            onClick={() => void startConnect()}
            disabled={isConnecting}
          >
            {isConnecting ? "Connecting..." : "Connect WhatsApp Business"}
          </Button>
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            You&apos;ll sign in with Facebook and pick the number to use.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {connections.map((connection) => (
            <ConnectionCard
              key={connection.id}
              connection={connection}
              isBusy={busyId === connection.id}
              onRefresh={() => void doRefresh(connection)}
              onReconnect={() => void startConnect()}
              onDisconnect={() => setConfirmDisconnect(connection)}
              onSaved={(updated) =>
                setConnections((current) =>
                  (current ?? []).map((row) =>
                    row.id === updated.id ? updated : row,
                  ),
                )
              }
            />
          ))}
          <Button
            variant="secondary"
            onClick={() => void startConnect()}
            disabled={isConnecting}
          >
            {isConnecting ? "Connecting..." : "Connect another number"}
          </Button>
        </div>
      )}

      <Modal
        isOpen={confirmDisconnect !== null}
        onClose={() => setConfirmDisconnect(null)}
        title="Disconnect this number?"
        description={
          confirmDisconnect
            ? `${confirmDisconnect.groups.length} ${
                confirmDisconnect.groups.length === 1 ? "group" : "groups"
              } will stop using WhatsApp. Members keep their messages in the app.`
            : ""
        }
        maxWidthClassName="max-w-sm"
        footer={
          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              onClick={() => setConfirmDisconnect(null)}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => void doDisconnect()}
              disabled={isDisconnecting}
            >
              {isDisconnecting ? "Disconnecting..." : "Disconnect"}
            </Button>
          </div>
        }
      >
        {null}
      </Modal>
    </section>
  );
}

const STATUS_STYLE: Record<WhatsAppConnection["status"], string> = {
  active:
    "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300",
  error: "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300",
  suspended:
    "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300",
};

const STATUS_LABEL: Record<WhatsAppConnection["status"], string> = {
  active: "Active",
  error: "Needs attention",
  suspended: "Suspended by Meta",
};

function ConnectionCard({
  connection,
  isBusy,
  onRefresh,
  onReconnect,
  onDisconnect,
  onSaved,
}: {
  connection: WhatsAppConnection;
  isBusy: boolean;
  onRefresh: () => void;
  onReconnect: () => void;
  onDisconnect: () => void;
  onSaved: (connection: WhatsAppConnection) => void;
}) {
  return (
    <article className="rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-semibold text-slate-900 dark:text-slate-100">
            {connection.verifiedName || "WhatsApp Business"}
          </p>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            {connection.displayPhoneNumber}
          </p>
        </div>
        <span
          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
            STATUS_STYLE[connection.status]
          }`}
        >
          {STATUS_LABEL[connection.status]}
        </span>
      </div>

      {connection.status !== "active" && connection.lastError && (
        <p className="mt-3 flex items-start gap-2 rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">
          <TriangleAlert className="mt-px h-3.5 w-3.5 shrink-0" />
          <span>{connection.lastError}</span>
        </p>
      )}

      <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
        <div className="flex justify-between gap-3">
          <dt className="text-slate-500 dark:text-slate-400">Quality</dt>
          <dd className="font-medium text-slate-900 dark:text-slate-100">
            {connection.qualityRating || "Unknown"}
          </dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-slate-500 dark:text-slate-400">
            Messaging limit
          </dt>
          <dd className="font-medium text-slate-900 dark:text-slate-100">
            {connection.messagingLimitTier || "Unknown"}
          </dd>
        </div>
      </dl>

      <div className="mt-3">
        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
          Groups using this number
        </p>
        {connection.groups.length === 0 ? (
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            None yet. Add it from a group&apos;s WhatsApp settings.
          </p>
        ) : (
          <ul className="mt-1 flex flex-wrap gap-1.5">
            {connection.groups.map((group) => (
              <li
                key={group.id}
                className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-700 dark:bg-slate-800 dark:text-slate-300"
              >
                {group.name}
                {group.keyword && (
                  <span className="ml-1 font-mono text-slate-500 dark:text-slate-400">
                    #{group.keyword}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="secondary"
          onClick={onRefresh}
          disabled={isBusy}
        >
          <RefreshCw className={`h-4 w-4 ${isBusy ? "animate-spin" : ""}`} />
          Refresh
        </Button>
        {connection.status === "error" && (
          <Button size="sm" variant="secondary" onClick={onReconnect}>
            Reconnect
          </Button>
        )}
        <Button size="sm" variant="danger" onClick={onDisconnect}>
          Disconnect
        </Button>
      </div>

      <TemplateFields connection={connection} onSaved={onSaved} />
    </article>
  );
}

/**
 * The three template names, behind a disclosure.
 *
 * Advanced on purpose: they only matter outside the 24-hour session window,
 * and they have to exist and be APPROVED on the person's own WhatsApp
 * Business account - which is not something this app can do for them.
 */
function TemplateFields({
  connection,
  onSaved,
}: {
  connection: WhatsAppConnection;
  onSaved: (connection: WhatsAppConnection) => void;
}) {
  const [notification, setNotification] = useState(
    connection.notificationTemplateName,
  );
  const [language, setLanguage] = useState(
    connection.notificationTemplateLanguage,
  );
  const [invitation, setInvitation] = useState(
    connection.invitationTemplateName,
  );
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const save = async () => {
    setIsSaving(true);
    setSaveError(null);
    setSaved(false);
    const result = await updateConnectionTemplates(connection.id, {
      notificationTemplateName: notification,
      notificationTemplateLanguage: language,
      invitationTemplateName: invitation,
    });
    setIsSaving(false);
    if (!result.ok) {
      setSaveError(result.message);
      return;
    }
    setSaved(true);
    onSaved(result.data);
  };

  return (
    <details className="mt-4 border-t border-slate-200 pt-3 dark:border-slate-700">
      <summary className="cursor-pointer text-xs font-semibold text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200">
        Advanced: message templates
      </summary>

      <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
        Templates must be approved on your WhatsApp Business account. They are
        used when a member hasn&apos;t written to you in the last 24 hours.
      </p>

      <div className="mt-3 space-y-3">
        <label className="block text-xs font-medium text-slate-600 dark:text-slate-300">
          Notification template
          <Input
            className="mt-1"
            value={notification}
            onChange={(event) => setNotification(event.target.value)}
            placeholder="group_message"
          />
        </label>
        <label className="block text-xs font-medium text-slate-600 dark:text-slate-300">
          Template language
          <Input
            className="mt-1"
            value={language}
            onChange={(event) => setLanguage(event.target.value)}
            placeholder="en_US"
          />
        </label>
        <label className="block text-xs font-medium text-slate-600 dark:text-slate-300">
          Invitation template
          <Input
            className="mt-1"
            value={invitation}
            onChange={(event) => setInvitation(event.target.value)}
            placeholder="group_invitation"
          />
        </label>

        {saveError && <Alert variant="error">{saveError}</Alert>}
        {saved && <Alert variant="success">Template names saved.</Alert>}

        <Button size="sm" onClick={() => void save()} disabled={isSaving}>
          {isSaving ? "Saving..." : "Save templates"}
        </Button>
      </div>
    </details>
  );
}
