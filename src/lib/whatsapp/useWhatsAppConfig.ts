"use client";

import { useEffect, useState } from "react";
import { fetchWhatsAppConfig } from "@/lib/whatsapp/api";
import type { WhatsAppConfig } from "@/lib/whatsapp/types";

/**
 * Whether WhatsApp exists here at all, and what Embedded Signup needs.
 *
 * Cached for the page's lifetime and shared by every caller: this is a
 * deployment fact, not a user one, and three entry points asking separately
 * would be three requests for the same four fields on every render of a
 * settings dialog.
 *
 * Until it has answered, `config` is null and `isLoading` is true - which is
 * what every entry point checks, so nothing WhatsApp-shaped flashes on screen
 * before we know it is switched on.
 */

let cached: WhatsAppConfig | null = null;
let inFlight: Promise<WhatsAppConfig | null> | null = null;

function load(): Promise<WhatsAppConfig | null> {
  if (cached) return Promise.resolve(cached);
  inFlight ??= fetchWhatsAppConfig()
    .then((result) => {
      // A failure is not cached: it is usually the network, and the next
      // screen that asks should get a fresh attempt rather than a sticky "no".
      if (!result.ok) return null;
      cached = result.data;
      return cached;
    })
    .finally(() => {
      inFlight = null;
    });
  return inFlight;
}

export function useWhatsAppConfig(): {
  config: WhatsAppConfig | null;
  isLoading: boolean;
  /** The one question most callers have: may I show a WhatsApp control? */
  isEnabled: boolean;
} {
  const [config, setConfig] = useState<WhatsAppConfig | null>(cached);
  const [isLoading, setIsLoading] = useState(cached === null);

  useEffect(() => {
    if (cached) return;
    let cancelled = false;

    load().then((result) => {
      if (cancelled) return;
      setConfig(result);
      setIsLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return { config, isLoading, isEnabled: config?.enabled === true };
}

/** Test seam: forget what a previous case cached. */
export function resetWhatsAppConfigForTests(): void {
  cached = null;
  inFlight = null;
}
