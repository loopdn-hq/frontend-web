"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createConnection } from "@/lib/whatsapp/api";
import { loadFacebookSdk } from "@/lib/whatsapp/facebookSdk";
import type {
  EmbeddedSignupResult,
  WhatsAppConfig,
  WhatsAppConnection,
} from "@/lib/whatsapp/types";

/**
 * Meta Embedded Signup, as one call.
 *
 * The flow hands its two halves back through two unrelated channels, and there
 * is no promise that joins them:
 *
 *   - FB.login's callback gives the authorization CODE;
 *   - a window `message` from facebook.com gives the WABA and phone number id.
 *
 * Either can arrive first, and a person who closes the popup produces neither.
 * So both are collected into one box and the connection is posted the moment
 * the box is full - which is why this is a hook with a small state machine
 * rather than an awaited call.
 *
 * THE CODE IS SINGLE-USE AND SHORT-LIVED. It is posted once, never retried and
 * never logged; a failed exchange means running the flow again for a new one.
 */

export type ConnectPhase =
  | "idle"
  | "loading-sdk"
  // The popup is open, or one half has arrived and the other has not.
  | "awaiting"
  | "submitting"
  | "connected"
  | "error";

/** The whole flow, from the click to a connection. Generous: a person is typing. */
const FLOW_TIMEOUT_MS = 5 * 60_000;

/**
 * How long the second half may take once the first has arrived. Short,
 * because by then nobody is being asked anything - these are two messages
 * from the same completed step.
 */
const PARTNER_TIMEOUT_MS = 60_000;

type Partial = {
  code?: string;
  wabaId?: string;
  phoneNumberId?: string;
  businessId?: string;
};

/** Only facebook.com and its subdomains may speak for Embedded Signup. */
export function isFacebookOrigin(origin: string): boolean {
  try {
    const { hostname, protocol } = new URL(origin);
    return (
      protocol === "https:" &&
      (hostname === "facebook.com" || hostname.endsWith(".facebook.com"))
    );
  } catch {
    return false;
  }
}

export type SignupMessage =
  | {
      kind: "finish";
      wabaId: string;
      phoneNumberId: string;
      businessId?: string;
    }
  | { kind: "cancel" }
  | { kind: "error"; message: string }
  | null;

/**
 * Reads one `message` event, or decides it is not ours.
 *
 * Meta has changed this payload between versions, so everything is checked
 * rather than assumed: the data may be a JSON string or an object, and the
 * ids have lived under `data` throughout but are read defensively.
 */
export function parseSignupMessage(raw: unknown): SignupMessage {
  let payload: unknown = raw;
  if (typeof raw === "string") {
    try {
      payload = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (!payload || typeof payload !== "object") return null;

  const frame = payload as Record<string, unknown>;
  if (frame.type !== "WA_EMBEDDED_SIGNUP") return null;

  const data = (
    frame.data && typeof frame.data === "object" ? frame.data : {}
  ) as Record<string, unknown>;
  const event = typeof frame.event === "string" ? frame.event : "";

  if (event === "FINISH" || event === "FINISH_ONLY_WABA") {
    const wabaId = typeof data.waba_id === "string" ? data.waba_id : "";
    const phoneNumberId =
      typeof data.phone_number_id === "string" ? data.phone_number_id : "";
    if (!wabaId || !phoneNumberId) {
      return {
        kind: "error",
        message:
          "WhatsApp finished without a number. Make sure a phone number is selected, then try again.",
      };
    }
    return {
      kind: "finish",
      wabaId,
      phoneNumberId,
      businessId:
        typeof data.business_id === "string" ? data.business_id : undefined,
    };
  }

  if (event === "CANCEL") return { kind: "cancel" };
  if (event === "ERROR") {
    const detail =
      typeof data.error_message === "string" ? data.error_message : "";
    return {
      kind: "error",
      message: detail || "WhatsApp couldn't complete the connection.",
    };
  }
  return null;
}

type UseWhatsAppConnectOptions = {
  config: WhatsAppConfig | null;
};

export function useWhatsAppConnect({ config }: UseWhatsAppConnectOptions) {
  const [phase, setPhase] = useState<ConnectPhase>("idle");
  const [error, setError] = useState<string | null>(null);

  // One attempt's worth of state, reachable from listeners and timers that
  // outlive the render they were created in.
  const partialRef = useRef<Partial>({});
  const settleRef = useRef<
    ((connection: WhatsAppConnection | null) => void) | null
  >(null);
  const cleanupRef = useRef<(() => void) | null>(null);
  const submittedRef = useRef(false);

  const finish = useCallback(
    (connection: WhatsAppConnection | null, message?: string) => {
      cleanupRef.current?.();
      cleanupRef.current = null;
      partialRef.current = {};

      if (message) {
        setError(message);
        setPhase("error");
      } else {
        setError(null);
        setPhase(connection ? "connected" : "idle");
      }

      const settle = settleRef.current;
      settleRef.current = null;
      settle?.(connection);
    },
    [],
  );

  // Leaving the page mid-flow must not leave a listener or a timer behind.
  //
  // The cleanup is read when the component unmounts, not when this effect
  // runs: at mount there is no attempt in progress, so returning
  // `cleanupRef.current` directly would return null and the window listener
  // would outlive the component. A leaked listener keeps answering FINISH
  // frames for a flow nobody is waiting on.
  useEffect(
    () => () => {
      cleanupRef.current?.();
      cleanupRef.current = null;
    },
    [],
  );

  /**
   * Opens Embedded Signup. Resolves with the new connection, or null if the
   * person cancelled; a failure resolves null too and leaves `error` set, so
   * a caller resuming an action can simply check for null.
   */
  const connect = useCallback(async (): Promise<WhatsAppConnection | null> => {
    if (!config?.enabled || !config.appId || !config.configId) {
      setError("WhatsApp isn't available on this deployment.");
      setPhase("error");
      return null;
    }
    // One at a time: a second popup would race the first for the same code.
    if (settleRef.current) return null;

    setError(null);
    setPhase("loading-sdk");
    partialRef.current = {};
    submittedRef.current = false;

    let sdk;
    try {
      sdk = await loadFacebookSdk(config.appId, config.graphVersion);
    } catch (sdkError) {
      setError(
        sdkError instanceof Error
          ? sdkError.message
          : "Couldn't load Facebook. Please try again.",
      );
      setPhase("error");
      return null;
    }

    return new Promise<WhatsAppConnection | null>((resolve) => {
      settleRef.current = resolve;
      setPhase("awaiting");

      let flowTimer = 0;
      let partnerTimer = 0;

      const onMessage = (event: MessageEvent) => {
        // The origin check comes first and is not negotiable: without it any
        // page in any frame could hand us a WABA id to connect.
        if (!isFacebookOrigin(event.origin)) return;
        const parsed = parseSignupMessage(event.data);
        if (!parsed) return;

        if (parsed.kind === "cancel") {
          finish(null);
          return;
        }
        if (parsed.kind === "error") {
          finish(null, parsed.message);
          return;
        }

        partialRef.current = {
          ...partialRef.current,
          wabaId: parsed.wabaId,
          phoneNumberId: parsed.phoneNumberId,
          businessId: parsed.businessId,
        };
        void submitIfReady();
      };

      const startPartnerTimer = () => {
        if (partnerTimer) return;
        partnerTimer = window.setTimeout(() => {
          finish(
            null,
            "WhatsApp didn't finish sending us the connection. Please try again.",
          );
        }, PARTNER_TIMEOUT_MS);
      };

      const submitIfReady = async () => {
        const { code, wabaId, phoneNumberId, businessId } = partialRef.current;
        if (!code || !wabaId || !phoneNumberId) {
          // Half of it is here; the other half has a short leash.
          if (code || wabaId) startPartnerTimer();
          return;
        }
        // Belt and braces around the single-use code: even if both channels
        // fire twice, it is exchanged exactly once.
        if (submittedRef.current) return;
        submittedRef.current = true;

        setPhase("submitting");
        const signup: EmbeddedSignupResult = {
          code,
          wabaId,
          phoneNumberId,
          businessId,
        };
        // Cleared before the request: nothing should hold the code once it
        // has been handed over.
        partialRef.current = {};

        const result = await createConnection(signup);
        if (result.ok) {
          finish(result.data);
        } else {
          finish(null, result.message);
        }
      };

      cleanupRef.current = () => {
        window.removeEventListener("message", onMessage);
        if (flowTimer) window.clearTimeout(flowTimer);
        if (partnerTimer) window.clearTimeout(partnerTimer);
      };

      window.addEventListener("message", onMessage);
      flowTimer = window.setTimeout(() => {
        finish(null, "The WhatsApp connection timed out. Please try again.");
      }, FLOW_TIMEOUT_MS);

      // Deliberately NOT async: FB.login hands its callback straight into the
      // popup's own flow, and an async callback returns a promise it ignores.
      sdk.login(
        (response) => {
          const code = response?.authResponse?.code;
          if (!code) {
            // No code and no FINISH message: the popup was closed or refused.
            if (!partialRef.current.wabaId) finish(null);
            return;
          }
          partialRef.current = { ...partialRef.current, code };
          void submitIfReady();
        },
        {
          config_id: config.configId,
          response_type: "code",
          override_default_response_type: true,
          extras: { setup: {}, sessionInfoVersion: "3" },
        },
      );
    });
  }, [config, finish]);

  const reset = useCallback(() => {
    setError(null);
    setPhase("idle");
  }, []);

  return {
    connect,
    reset,
    phase,
    error,
    isConnecting:
      phase === "loading-sdk" || phase === "awaiting" || phase === "submitting",
  };
}
