/**
 * Settings kept in this browser: for screens that are ahead of the API
 * (Notifications, Privacy, Messaging), and for settings that belong to a
 * device rather than an account (Appearance). Each describes its settings
 * once - groups, rows, labels,
 * options and defaults - and gets its store from here, so there is one copy of
 * "read localStorage safely, keep tabs in step, survive blocked storage" rather
 * than one per screen.
 *
 * Values are per BROWSER, not per account: a second account signed in on the
 * same browser sees the same values. Nothing on the server reads them.
 */
import { useSyncExternalStore } from "react";

export type PreferenceValues = Record<string, boolean | string>;

export type ChoiceOption = { value: string; label: string };

/** The keys of T whose values are of type V. */
type KeysOf<T, V> = {
  [K in keyof T]-?: T[K] extends V ? K : never;
}[keyof T] &
  string;

/**
 * One row on a settings screen.
 *
 * The kind is how the design draws it, not what it stores: a switch and a
 * checkbox are both a boolean, and a choice, radio buttons and a dropdown are
 * all one of `options`. A "choice" shows its current option and opens a view
 * of its own, with `description` under that view's heading.
 */
export type PreferenceRow<T> =
  | {
      kind: "switch" | "checkbox";
      key: KeysOf<T, boolean>;
      label: string;
      description?: string;
    }
  | {
      kind: "choice";
      key: KeysOf<T, string>;
      label: string;
      description: string;
      options: readonly ChoiceOption[];
    }
  | {
      kind: "radio" | "select";
      key: KeysOf<T, string>;
      label: string;
      description?: string;
      options: readonly ChoiceOption[];
    };

export type ChoiceRow<T> = Extract<PreferenceRow<T>, { kind: "choice" }>;

/** A card of rows, with a small heading above it, or none. */
export type PreferenceGroup<T> = {
  title: string | null;
  rows: readonly PreferenceRow<T>[];
};

/** The choice row named `key`, if there is one - what a section's open view is. */
export function findChoiceRow<T>(
  groups: readonly PreferenceGroup<T>[],
  key: string | null,
): ChoiceRow<T> | undefined {
  if (key === null) return undefined;
  for (const group of groups) {
    for (const row of group.rows) {
      if (row.kind === "choice" && row.key === key) return row;
    }
  }
  return undefined;
}

/**
 * A store for the browser-kept values `defaults` describes.
 *
 * `groups` may describe more than the store keeps - Messaging's list also has
 * a row saved on the account - which is why it has its own type parameter.
 * Only its options are read here, to validate what comes back from storage.
 */
export function createLocalPreferences<
  T extends PreferenceValues,
  G extends PreferenceValues = T,
>({
  storageKey,
  defaults,
  groups,
}: {
  storageKey: string;
  defaults: T;
  groups: readonly PreferenceGroup<G>[];
}) {
  // What each option-bearing row currently offers. A stored option that is no
  // longer offered falls back to the default instead of showing a blank row.
  const offered = new Map<string, string[]>();
  for (const group of groups) {
    for (const row of group.rows) {
      if ("options" in row) {
        offered.set(
          row.key,
          row.options.map((option) => option.value),
        );
      }
    }
  }

  /**
   * Stored JSON back into values, one known key at a time. Unknown keys are
   * dropped, and a value of the wrong type falls back to the default, so a
   * setting renamed later cannot leave a screen drawing `undefined`.
   */
  function parse(raw: string | null): T {
    if (!raw) return defaults;

    let stored: unknown;
    try {
      stored = JSON.parse(raw);
    } catch {
      return defaults;
    }
    if (!stored || typeof stored !== "object") return defaults;

    const record = stored as Record<string, unknown>;
    const values: PreferenceValues = { ...defaults };
    for (const key of Object.keys(defaults)) {
      const value = record[key];
      if (typeof value !== typeof defaults[key]) continue;
      if (typeof value === "string" && offered.has(key)) {
        if (!offered.get(key)!.includes(value)) continue;
      }
      values[key] = value as boolean | string;
    }
    return values as T;
  }

  function readStorage(): string | null {
    try {
      return localStorage.getItem(storageKey);
    } catch {
      // Private mode or blocked storage: the defaults, and saves hold in memory.
      return null;
    }
  }

  // What this tab believes, read from storage on first use. Held rather than
  // re-read on every render: useSyncExternalStore needs the same object back
  // until something changes, and with storage blocked a save must still stick.
  let current: T | null = null;
  const listeners = new Set<() => void>();
  const notify = () => listeners.forEach((listener) => listener());

  function getSnapshot(): T {
    if (current === null) current = parse(readStorage());
    return current;
  }

  // "storage" fires only in OTHER tabs; a key of null means storage was cleared.
  function handleStorage(event: StorageEvent) {
    if (event.key !== null && event.key !== storageKey) return;
    current = parse(event.newValue);
    notify();
  }

  function subscribe(listener: () => void): () => void {
    if (listeners.size === 0) {
      // Nobody was listening, so another tab may have saved unheard.
      current = null;
      window.addEventListener("storage", handleStorage);
    }
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
      if (listeners.size === 0) {
        window.removeEventListener("storage", handleStorage);
      }
    };
  }

  return {
    /**
     * The saved values, kept current. Every component using this sees the
     * same values - the settings page and the dialog cannot disagree.
     */
    useValues(): T {
      return useSyncExternalStore(subscribe, getSnapshot, () => defaults);
    },

    /** The current values, for code outside a render (lib/app/appearance). */
    get: getSnapshot,

    /** Calls `listener` whenever the values change, here or in another tab. */
    subscribe,

    /** Saves the keys given and leaves the rest alone. Never throws. */
    save(change: Partial<T>): void {
      current = { ...getSnapshot(), ...change };
      try {
        localStorage.setItem(storageKey, JSON.stringify(current));
      } catch {
        // The change still holds for this session.
      }
      notify();
    },
  };
}
