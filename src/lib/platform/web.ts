import type { Platform } from "./index";

/**
 * The browser implementation.
 *
 * Deliberately not a stack of no-ops: the web app has real answers for two of
 * these three, and using them keeps the desktop path from being the only one
 * that works.
 */
export const webPlatform: Platform = {
  async openExternal(url) {
    // Same-tab navigation, which is what every caller did directly before this
    // adapter existed - Stripe checkout hands the whole page over, and a
    // mailto: needs location rather than window.open (which leaves a blank tab
    // behind in some browsers). The desktop build is where this has to differ,
    // because there the page cannot navigate away from the app.
    window.location.assign(url);
  },

  async notify(title, body) {
    if (typeof Notification === "undefined") return;
    if (Notification.permission === "granted") {
      new Notification(title, { body });
      return;
    }
    // Never prompt from here. Asking for permission at an arbitrary moment is
    // how people learn to click Deny; the settings panel asks deliberately.
  },

  async setBadge() {
    // navigator.setAppBadge exists in some browsers, but only for an installed
    // PWA and not at all in others. The desktop build is where this is real.
  },
};
