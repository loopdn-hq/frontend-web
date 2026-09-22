/**
 * Capabilities that differ between the web app and the desktop shell.
 *
 * Importable from anywhere: there is no Tauri import in this file or in the
 * web implementation beside it. The desktop implementation lives under
 * src/lib/desktop/ and is loaded lazily, so the web bundle never carries it.
 *
 * The point is that components call platform.openExternal(url) and never learn
 * which build they are in - rather than every call site growing its own
 * isDesktop() branch.
 */
export interface Platform {
  /** Open a URL outside the app: the system browser, or a mail client. */
  openExternal(url: string): Promise<void>;
  /** Show a notification to the user. */
  notify(title: string, body: string): Promise<void>;
  /** Set an unread count on the dock/taskbar icon. No-op on the web. */
  setBadge(count: number): Promise<void>;
}

import { webPlatform } from "./web";

let impl: Platform = webPlatform;

/** Replace the implementation. Called once at startup, by the desktop entry only. */
export function setPlatform(next: Platform): void {
  impl = next;
}

export const platform: Platform = {
  openExternal: (url) => impl.openExternal(url),
  notify: (title, body) => impl.notify(title, body),
  setBadge: (count) => impl.setBadge(count),
};
