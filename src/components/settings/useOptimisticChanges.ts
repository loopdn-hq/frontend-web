"use client";

import { useState } from "react";

/**
 * Settings that save the moment they change, shown before the save settles.
 *
 * `shown` is the host's values with any in-flight change laid over them. A
 * key is dropped from `pending` when its save settles: on success the host
 * already holds the new value, on failure it still holds the old one - either
 * way the host is right, and nothing has to be put back by hand.
 *
 * A key that is saving ignores further changes until it settles, so two quick
 * presses cannot race each other to the server. `onSave` must THROW on failure;
 * its message is what `error` shows.
 */
export function useOptimisticChanges<T extends object>(
  values: T,
  onSave?: (change: Partial<T>) => Promise<void> | void,
) {
  const [pending, setPending] = useState<Partial<T>>({});
  const [error, setError] = useState<string | null>(null);

  async function change<K extends keyof T>(key: K, value: T[K]) {
    if (key in pending) return;

    // A computed key widens to `string` in TypeScript; K keeps it exact.
    const patch = { [key]: value } as unknown as Partial<T>;
    setPending((current) => ({ ...current, ...patch }));
    setError(null);
    try {
      await onSave?.(patch);
    } catch (err) {
      setError(
        err instanceof Error && err.message
          ? err.message
          : "Couldn't save that. Try again.",
      );
    } finally {
      setPending((current) => {
        const next = { ...current };
        delete next[key];
        return next;
      });
    }
  }

  return {
    shown: { ...values, ...pending } as T,
    isBusy: (key: keyof T) => key in pending,
    change,
    error,
  };
}
