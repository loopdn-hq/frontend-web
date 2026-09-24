/**
 * Where the desktop installers live, and which one a visitor most likely wants.
 *
 * The release host is not live yet (see the desktop plan, "What remains"), so
 * these URLs are placeholders pointing at the paths the release pipeline is
 * specified to publish. Everything the download page links to is declared here
 * so that switching to real, versioned artifacts - or to reading the channel's
 * latest.json at runtime - is a change to this file and nothing else.
 */

/** CloudFront distribution in front of the private release bucket. */
const DOWNLOADS_BASE_URL = "https://downloads.loopdn.com";

/** Release channel the public download page offers. */
const CHANNEL = "stable";

export type DesktopOs = "mac" | "windows";

export type DesktopInstaller = {
  os: DesktopOs;
  /** Button label, and what the OS is called in prose. */
  label: string;
  /** Shown under the platform buttons once an OS is detected. */
  requirement: string;
  url: string;
};

export const DESKTOP_INSTALLERS: Record<DesktopOs, DesktopInstaller> = {
  mac: {
    os: "mac",
    label: "Mac",
    requirement: "macOS 11 Big Sur or later. Apple silicon and Intel.",
    url: `${DOWNLOADS_BASE_URL}/desktop/${CHANNEL}/Loopdn_universal.dmg`,
  },
  windows: {
    os: "windows",
    label: "Windows",
    requirement: "Windows 10 or 11, 64-bit.",
    url: `${DOWNLOADS_BASE_URL}/desktop/${CHANNEL}/Loopdn_x64-setup.exe`,
  },
};

/**
 * Best guess at the visitor's desktop OS, or null when it is neither (a phone,
 * Linux, or a browser that tells us nothing useful).
 *
 * Only ever used to pick which installer the big button offers first - both
 * are always reachable, so a wrong guess costs a click rather than a dead end.
 * Call this from an effect: the exported HTML is built without a navigator,
 * and branching on it during render would not match what the server wrote.
 */
export function detectDesktopOs(): DesktopOs | null {
  if (typeof navigator === "undefined") return null;

  const ua = navigator.userAgent;
  // Order matters: iPadOS reports "Macintosh", and a phone should not be sold
  // a desktop installer, so the mobile check has to come first.
  if (/Android|iPhone|iPad|iPod/i.test(ua)) return null;
  if (/Mac/i.test(ua)) return "mac";
  if (/Win/i.test(ua)) return "windows";
  return null;
}
