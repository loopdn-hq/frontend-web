"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge, Button } from "@/components/ui";
import {
  disablePush,
  enablePush,
  readPushState,
  type PushState,
} from "@/lib/app/push";
import { SettingsGroup } from "./SettingsRows";

/**
 * The one row on this screen that is about the BROWSER, not the account.
 *
 * Every switch below it says what you are told about, and is saved on your
 * account. This says whether this particular browser may show you anything at
 * all, and it cannot be saved anywhere: permission belongs to the browser, so
 * a phone and a laptop each have to be turned on once.
 *
 * It is rendered at the top for the same reason: with this off, none of the
 * switches under it can do anything, and a screen that does not say so reads
 * as broken.
 *
 * Hand-built rather than a `PreferenceRow`: those bind to a key of a saved
 * preferences object, and this has no key to bind to. The markup matches
 * SecuritySection's button rows so the two screens look like one product.
 */
export function PushOnThisBrowser() {
  // Null until the effect has run. `Notification.permission` does not exist on
  // the server, so reading it during render would differ between the markup
  // and the first paint.
  const [state, setState] = useState<PushState | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    readPushState().then(setState);
  }, []);

  useEffect(refresh, [refresh]);

  const turnOn = async () => {
    setIsBusy(true);
    setError(null);
    const result = await enablePush();
    if (!result.ok) setError(result.message);
    refresh();
    setIsBusy(false);
  };

  const turnOff = async () => {
    setIsBusy(true);
    setError(null);
    const result = await disablePush();
    if (!result.ok) setError(result.message);
    refresh();
    setIsBusy(false);
  };

  return (
    <SettingsGroup title="This browser">
      <div className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
            Notifications on this browser
          </p>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            {describe(state)}
          </p>
          {error && (
            <p
              role="alert"
              className="mt-1 text-xs text-rose-600 dark:text-rose-400"
            >
              {error}
            </p>
          )}
        </div>

        <div className="shrink-0">
          {control(state, isBusy, turnOn, turnOff)}
        </div>
      </div>
    </SettingsGroup>
  );
}

function describe(state: PushState | null): string {
  if (state === null) return "Checking…";

  if (state.support === "needs-install") {
    return "On iPhone and iPad, add Loopd'n to your Home Screen first. Then notifications can be turned on here.";
  }
  if (state.support === "unsupported") {
    return "This browser cannot show notifications.";
  }
  if (!state.available) {
    return "Notifications are not switched on for this server yet.";
  }
  if (state.permission === "denied") {
    return "Blocked in your browser's settings for this site. Allow notifications there, then come back.";
  }
  if (state.subscribed && state.permission === "granted") {
    return "On. You will be notified here even when Loopd'n is closed. Each device is turned on separately.";
  }
  return "Off. Turn it on to be notified when Loopd'n is closed.";
}

function control(
  state: PushState | null,
  isBusy: boolean,
  turnOn: () => void,
  turnOff: () => void,
) {
  if (state === null) return null;

  if (state.support !== "ready" || !state.available) {
    return <Badge tone="neutral">Not available</Badge>;
  }
  if (state.permission === "denied") {
    return <Badge tone="warning">Blocked</Badge>;
  }

  if (state.subscribed && state.permission === "granted") {
    return (
      <div className="flex items-center gap-2">
        <Badge tone="success">On</Badge>
        <Button
          variant="secondary"
          size="sm"
          onClick={turnOff}
          aria-disabled={isBusy}
          aria-busy={isBusy}
        >
          Turn off
        </Button>
      </div>
    );
  }

  return (
    <Button
      variant="secondary"
      size="sm"
      onClick={turnOn}
      aria-disabled={isBusy}
      aria-busy={isBusy}
    >
      Turn on
    </Button>
  );
}
