"use client";

import { useCallback, useEffect, useState } from "react";
import { ExternalLink, MessageCircle } from "lucide-react";
import { Alert, Button, Input, Select, Switch } from "@/components/ui";
import {
  attachGroupWhatsApp,
  detachGroupWhatsApp,
  fetchConnections,
  fetchGroupWhatsApp,
  setGroupWhatsAppConsent,
} from "@/lib/whatsapp/api";
import { useWhatsAppConfig } from "@/lib/whatsapp/useWhatsAppConfig";
import { useWhatsAppConnect } from "@/lib/whatsapp/useWhatsAppConnect";
import type {
  GroupWhatsAppState,
  WhatsAppConnection,
} from "@/lib/whatsapp/types";

type GroupWhatsAppPanelProps = {
  conversationId: string | number;
  /** Sends the member to the existing phone-verification flow. */
  onVerifyPhone?: () => void;
};

/**
 * WhatsApp, inside one group.
 *
 * Two audiences in one panel, because they are two different questions:
 * an admin decides whether the GROUP is on WhatsApp, and every member decides
 * whether THEY are. Neither can answer for the other - Meta requires the
 * member's opt-in to be their own act, so an admin toggling the group on does
 * not opt anybody in.
 */
export function GroupWhatsAppPanel({
  conversationId,
  onVerifyPhone,
}: GroupWhatsAppPanelProps) {
  const { config, isEnabled } = useWhatsAppConfig();
  const [state, setState] = useState<GroupWhatsAppState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  // Not async; see the same shape in WhatsAppSettingsSection - state is set
  // in the `.then`, never in the effect's own body.
  const load = useCallback(
    () =>
      fetchGroupWhatsApp(conversationId).then((result) => {
        setIsLoading(false);
        if (result.ok) {
          setState(result.data);
          setError(null);
        } else {
          setError(result.message);
        }
      }),
    [conversationId],
  );

  useEffect(() => {
    if (!isEnabled) return;
    void load();
  }, [isEnabled, load]);

  const setConsent = useCallback(
    async (enabled: boolean) => {
      setIsBusy(true);
      setError(null);
      const result = await setGroupWhatsAppConsent(conversationId, enabled);
      setIsBusy(false);
      if (result.ok) {
        setState(result.data);
        return;
      }
      // The one refusal with somewhere to go: they cannot be reached on
      // WhatsApp until the number is verified.
      if (result.reason === "no_verified_number") {
        setError(result.message);
        onVerifyPhone?.();
        return;
      }
      setError(result.message);
      if (result.reason === "not_attached") void load();
    },
    [conversationId, load, onVerifyPhone],
  );

  if (!isEnabled) return null;
  if (isLoading) {
    return (
      <p className="text-sm text-slate-500 dark:text-slate-400">
        Loading WhatsApp...
      </p>
    );
  }
  // A group that is not on WhatsApp is not a thing a member needs told about.
  if (!state) return error ? <Alert variant="error">{error}</Alert> : null;
  if (!state.connected && !state.isAdmin) return null;

  return (
    <section aria-labelledby="group-whatsapp-title" className="space-y-4">
      <header>
        <h3
          id="group-whatsapp-title"
          className="flex items-center gap-2 text-base font-semibold text-slate-900 dark:text-slate-100"
        >
          <MessageCircle className="h-4 w-4 text-emerald-600" />
          WhatsApp
        </h3>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          {state.connected
            ? "This group can reach members on WhatsApp, and replies come back here."
            : "Put this group on your WhatsApp Business number so members can read and reply there."}
        </p>
      </header>

      {error && <Alert variant="error">{error}</Alert>}

      {state.isAdmin &&
        (state.connected && state.channel ? (
          <AdminAttached
            conversationId={conversationId}
            state={state}
            onChanged={setState}
            onError={setError}
          />
        ) : (
          <AdminAttach
            conversationId={conversationId}
            config={config}
            onAttached={setState}
            onError={setError}
          />
        ))}

      {state.connected && state.channel && (
        <MemberConsent
          state={state}
          isBusy={isBusy}
          onChange={(enabled) => void setConsent(enabled)}
          onVerifyPhone={onVerifyPhone}
        />
      )}
    </section>
  );
}

/** Admin, group not yet on WhatsApp: choose a number (or connect one). */
function AdminAttach({
  conversationId,
  config,
  onAttached,
  onError,
}: {
  conversationId: string | number;
  config: ReturnType<typeof useWhatsAppConfig>["config"];
  onAttached: (state: GroupWhatsAppState) => void;
  onError: (message: string | null) => void;
}) {
  const [connections, setConnections] = useState<WhatsAppConnection[] | null>(
    null,
  );
  const [selected, setSelected] = useState<string>("");
  const [keyword, setKeyword] = useState("");
  const [keywordError, setKeywordError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const {
    connect,
    isConnecting,
    error: connectError,
  } = useWhatsAppConnect({
    config,
  });

  const load = useCallback(
    () =>
      fetchConnections().then((result) => {
        if (!result.ok) {
          setConnections([]);
          return;
        }
        setConnections(result.data);
        setSelected((current) => current || String(result.data[0]?.id ?? ""));
      }),
    [],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const attach = useCallback(
    async (connectionId: number) => {
      setIsBusy(true);
      setKeywordError(null);
      onError(null);
      const result = await attachGroupWhatsApp(conversationId, {
        connection: connectionId,
        ...(keyword.trim() ? { keyword: keyword.trim() } : {}),
      });
      setIsBusy(false);
      if (result.ok) {
        onAttached(result.data);
        return;
      }
      // A taken keyword belongs on the field, not in a banner at the top.
      if (result.reason === "keyword_taken") {
        setKeywordError(result.message);
        return;
      }
      onError(result.message);
    },
    [conversationId, keyword, onAttached, onError],
  );

  const connectThenAttach = useCallback(async () => {
    const connection = await connect();
    if (!connection) return;
    await load();
    await attach(connection.id);
  }, [attach, connect, load]);

  if (connections === null) {
    return (
      <p className="text-sm text-slate-500 dark:text-slate-400">Loading...</p>
    );
  }

  return (
    <div className="space-y-3 rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
      {connectError && <Alert variant="error">{connectError}</Alert>}

      {connections.length === 0 ? (
        <>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            You haven&apos;t connected a WhatsApp Business number yet.
          </p>
          <Button
            onClick={() => void connectThenAttach()}
            disabled={isConnecting || isBusy}
          >
            {isConnecting ? "Connecting..." : "Connect WhatsApp Business"}
          </Button>
        </>
      ) : (
        <>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-300">
            WhatsApp number
            <Select
              className="mt-1"
              value={selected}
              onChange={(event) => setSelected(event.target.value)}
              options={connections.map((connection) => ({
                value: String(connection.id),
                label: `${connection.displayPhoneNumber} - ${
                  connection.verifiedName || "WhatsApp Business"
                }`,
              }))}
            />
          </label>

          <label className="block text-xs font-medium text-slate-600 dark:text-slate-300">
            Keyword (optional)
            <Input
              className="mt-1"
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder="team"
              aria-invalid={keywordError ? true : undefined}
            />
          </label>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            One number can serve several groups. Members write{" "}
            <span className="font-mono">#{keyword.trim() || "keyword"}</span> on
            WhatsApp to pick this one.
          </p>
          {keywordError && <Alert variant="error">{keywordError}</Alert>}

          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => void attach(Number(selected))}
              disabled={!selected || isBusy}
            >
              {isBusy ? "Connecting..." : "Put this group on WhatsApp"}
            </Button>
            <Button
              variant="secondary"
              onClick={() => void connectThenAttach()}
              disabled={isConnecting || isBusy}
            >
              Connect another number
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

/** Admin, group already attached: keyword, the two toggles, and Detach. */
function AdminAttached({
  conversationId,
  state,
  onChanged,
  onError,
}: {
  conversationId: string | number;
  state: GroupWhatsAppState;
  onChanged: (state: GroupWhatsAppState) => void;
  onError: (message: string | null) => void;
}) {
  const channel = state.channel!;
  const [keyword, setKeyword] = useState(channel.keyword);
  const [keywordError, setKeywordError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  // Which of MY numbers this group is on.
  //
  // The group payload does not say: GroupChannelSerializer sends the
  // CHANNEL's id, the number and the name, but not the connection id - and
  // PUT wants the connection id. So it is resolved by asking which of my
  // connections lists this conversation among its groups.
  //
  // Null has a meaning worth keeping: an admin who is not the number's owner
  // has no connection to find, and PUT would 404 for them (the endpoint
  // filters connections to their owner). They can still detach.
  const [connectionId, setConnectionId] = useState<number | null>(null);
  const [isResolving, setIsResolving] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetchConnections().then((result) => {
      if (cancelled) return;
      setIsResolving(false);
      if (!result.ok) return;
      const mine = result.data.find((connection) =>
        connection.groups.some(
          (group) => String(group.id) === String(conversationId),
        ),
      );
      setConnectionId(mine?.id ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, [conversationId]);

  const update = useCallback(
    async (changes: {
      keyword?: string;
      deliveryEnabled?: boolean;
      repliesEnabled?: boolean;
    }) => {
      if (connectionId === null) return;
      setIsBusy(true);
      setKeywordError(null);
      onError(null);
      // PUT is the only way to change any of this, and it needs the number it
      // is already on - the endpoint attaches and edits through one door.
      const result = await attachGroupWhatsApp(conversationId, {
        connection: connectionId,
        ...changes,
      });
      setIsBusy(false);
      if (result.ok) {
        onChanged(result.data);
        return;
      }
      if (result.reason === "keyword_taken") {
        setKeywordError(result.message);
        return;
      }
      onError(result.message);
    },
    [connectionId, conversationId, onChanged, onError],
  );

  const detach = useCallback(async () => {
    setIsBusy(true);
    onError(null);
    const result = await detachGroupWhatsApp(conversationId);
    setIsBusy(false);
    if (result.ok) onChanged(result.data);
    else onError(result.message);
  }, [conversationId, onChanged, onError]);

  return (
    <div className="space-y-4 rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
      <div>
        <p className="font-semibold text-slate-900 dark:text-slate-100">
          {channel.verifiedName || "WhatsApp Business"}
        </p>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          {channel.displayPhoneNumber}
        </p>
        {channel.connectionStatus !== "active" && (
          <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
            This number needs attention in Settings → WhatsApp Business.
          </p>
        )}
      </div>

      {!isResolving && connectionId === null && (
        <p className="rounded-xl bg-slate-100 px-3 py-2 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          This number belongs to another admin, so only they can change its
          keyword and delivery settings. You can still take the group off
          WhatsApp.
        </p>
      )}

      <div className={connectionId === null ? "hidden" : undefined}>
        <label className="block text-xs font-medium text-slate-600 dark:text-slate-300">
          Keyword
          <div className="mt-1 flex gap-2">
            <Input
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder="team"
              aria-invalid={keywordError ? true : undefined}
            />
            <Button
              variant="secondary"
              onClick={() => void update({ keyword: keyword.trim() })}
              disabled={
                isBusy || isResolving || keyword.trim() === channel.keyword
              }
            >
              Save
            </Button>
          </div>
        </label>
        {keywordError && (
          <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">
            {keywordError}
          </p>
        )}
      </div>

      <ToggleRow
        label="Send group messages to WhatsApp"
        description="Members who opted in get this group's messages on WhatsApp."
        checked={channel.deliveryEnabled}
        disabled={isBusy || isResolving || connectionId === null}
        onChange={(value) => void update({ deliveryEnabled: value })}
      />
      <ToggleRow
        label="Accept replies from WhatsApp"
        description="What members write on WhatsApp is posted into this group."
        checked={channel.repliesEnabled}
        disabled={isBusy || isResolving || connectionId === null}
        onChange={(value) => void update({ repliesEnabled: value })}
      />

      <Button variant="danger" onClick={() => void detach()} disabled={isBusy}>
        Take this group off WhatsApp
      </Button>
    </div>
  );
}

/** Every member's own standing, admin or not. */
function MemberConsent({
  state,
  isBusy,
  onChange,
  onVerifyPhone,
}: {
  state: GroupWhatsAppState;
  isBusy: boolean;
  onChange: (enabled: boolean) => void;
  onVerifyPhone?: () => void;
}) {
  const channel = state.channel!;
  const optedIn = state.myConsent === "opted_in";
  const refused =
    state.myConsent === "declined" || state.myConsent === "opted_out";

  return (
    <div className="space-y-3 rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
      <ToggleRow
        label="Get this group on WhatsApp"
        description={
          optedIn
            ? `Messages go to your number from ${channel.displayPhoneNumber}.`
            : refused
              ? "You turned this off. You can turn it back on whenever you like."
              : "You choose this for yourself - nobody can turn it on for you."
        }
        checked={optedIn}
        disabled={isBusy || (!state.myNumberVerified && !optedIn)}
        onChange={onChange}
      />

      {!state.myNumberVerified && !optedIn && (
        <div className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
          <p>Verify your phone number first so WhatsApp can reach you.</p>
          {onVerifyPhone && (
            <button
              type="button"
              onClick={onVerifyPhone}
              className="mt-1 font-semibold underline"
            >
              Verify my number
            </button>
          )}
        </div>
      )}

      {channel.joinLink && (
        <a
          href={channel.joinLink}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-700 hover:underline dark:text-emerald-400"
        >
          Open in WhatsApp
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      )}
    </div>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
          {label}
        </p>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {description}
        </p>
      </div>
      <Switch
        checked={checked}
        onCheckedChange={onChange}
        disabled={disabled}
        aria-label={label}
      />
    </div>
  );
}
