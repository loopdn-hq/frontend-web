/**
 * Persistence for the nav rail's collapsed state.
 *
 * No pre-hydration script is needed the way the theme needs one: the (app)
 * layout renders nothing until useAuth reports isLoaded, so the rail is never
 * part of the prerendered HTML and cannot flash at the wrong width.
 */
const STORAGE_KEY = "loopdn_nav_collapsed";

export function readNavCollapsed(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    // Private mode or blocked storage - fall back to expanded.
    return false;
  }
}

export function writeNavCollapsed(collapsed: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, collapsed ? "1" : "0");
  } catch {
    // The toggle still works for this session.
  }
}
