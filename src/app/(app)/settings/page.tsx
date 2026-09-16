"use client";

import { useSyncExternalStore } from "react";
import { NavDrawerButton } from "@/components/app/NavDrawerButton";
import {
  isSettingsTab,
  settingsHref,
  UserSettingsPanel,
  type SettingsTab,
  type UserSettingsPanelProps,
} from "@/components/settings/UserSettingsPanel";
import { useUserSettingsProps } from "@/components/settings/useUserSettingsProps";

function subscribeToHash(onChange: () => void) {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
}

function tabFromHash(): SettingsTab | undefined {
  const fragment = window.location.hash.replace(/^#/, "");
  return isSettingsTab(fragment) ? fragment : undefined;
}

/**
 * The tab named by the URL, or undefined for plain `/settings/`.
 *
 * `useSyncExternalStore` rather than reading the hash into state on mount:
 * this page is prerendered at build time, where there is no hash at all, and
 * this is the hook whose whole purpose is to serve the server snapshot during
 * hydration and swap to the real one straight after - so the tab is right on
 * the first paint the user sees, with no mismatch and no flash of Profile.
 */
function useTabFromHash(): SettingsTab | undefined {
  return useSyncExternalStore(subscribeToHash, tabFromHash, () => undefined);
}

/**
 * The panel and its wiring as ONE keyed element.
 *
 * The wiring subscribes to the profile and to the browser-kept settings, so
 * every save re-renders whatever calls it. Called from the page, that
 * re-render re-read the hash - which `replaceState` had already moved to the
 * tab just clicked - found a new key, and remounted the panel mid-edit: a
 * Privacy picker closed on its first choice. Called here, below the key, a
 * save re-renders the panel and nothing above it.
 */
function ConnectedSettingsPanel(
  props: Pick<UserSettingsPanelProps, "initialTab" | "onTabChange">,
) {
  const settingsProps = useUserSettingsProps();
  return <UserSettingsPanel {...props} {...settingsProps} />;
}

/**
 * Settings as a page.
 *
 * The nav rail opens the same panel as a dialog, which is how most people will
 * reach it. This route stays for the links that already point at it and for
 * `/settings/#billing`-style deep links, and it shares its wiring with the
 * dialog rather than keeping a second copy.
 */
export default function SettingsPage() {
  const tab = useTabFromHash();

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-5xl">
        <NavDrawerButton className="mt-4 ml-4 bg-slate-900 text-white" />
        <ConnectedSettingsPanel
          // Remounted when the URL names a different tab, so a deep link lands
          // where it says even when Settings is already the open page.
          key={tab ?? "profile"}
          initialTab={tab}
          // Only the PAGE mirrors the tab into the address bar - it is the
          // thing the address names. The same panel rendered as a dialog over
          // another route must not touch the URL at all. `replaceState`
          // rather than a push: flipping tabs is not six entries of Back.
          onTabChange={(next) =>
            window.history.replaceState(null, "", settingsHref(next))
          }
        />
      </div>
    </div>
  );
}
