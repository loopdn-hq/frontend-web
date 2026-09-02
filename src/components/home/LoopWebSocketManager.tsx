"use client";

import { useEffect } from "react";
import { getAccessToken } from "@/lib/auth/client";
import { useWebSocket } from "@/lib/websocket/useWebSocket";

type WebSocketMessage = {
  type: string;
  [key: string]: unknown;
};

type LoopWebSocketManagerProps = {
  loopId?: string | number;
  onMessage?: (message: WebSocketMessage) => void;
  onConnected?: () => void;
  onDisconnected?: () => void;
  onError?: (error: Error) => void;
  children?: React.ReactNode;
};

declare global {
  interface Window {
    __loopWSSend?: (message: WebSocketMessage) => void;
    __loopWSStatus?: string;
  }
}

export function LoopWebSocketManager({
  onMessage,
  onConnected,
  onDisconnected,
  onError,
  children,
}: LoopWebSocketManagerProps) {
  const accessToken = getAccessToken();
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
  const protocol = apiBaseUrl?.startsWith("https:") ? "wss:" : "ws:";
  const configuredHost = process.env.NEXT_PUBLIC_WS_HOST;
  const apiHost = apiBaseUrl ? new URL(apiBaseUrl).host : "127.0.0.1:8000";
  const wsHost = configuredHost || apiHost;
  const url = `${protocol}//${wsHost}/ws/chat/?token=${encodeURIComponent(accessToken || "")}`;
  const wsEnabled = Boolean(accessToken);

  const { status, error, send } = useWebSocket({
    url,
    enabled: wsEnabled,
    onMessage,
    onConnect: onConnected,
    onDisconnect: onDisconnected,
    onError,
    reconnectAttempts: 5,
    reconnectDelay: 3000,
  });

  // Provide send function through window for now (will be improved)
  useEffect(() => {
    if (typeof window !== "undefined") {
      window.__loopWSSend = send;
      window.__loopWSStatus = status;
    }

    return () => {
      if (typeof window !== "undefined") {
        delete window.__loopWSSend;
        delete window.__loopWSStatus;
      }
    };
  }, [send, status]);

  // Render connection status indicator (optional)
  const statusColor =
    status === "connected"
      ? "bg-emerald-100 text-emerald-700"
      : status === "connecting"
        ? "bg-amber-100 text-amber-700"
        : status === "error"
          ? "bg-rose-100 text-rose-700"
          : "bg-slate-100 text-slate-700";

  return (
    <>
      {/* Optional: Connection status indicator - can be removed if not needed */}
      <div
        className={`hidden text-xs font-semibold px-2 py-1 rounded ${statusColor}`}
      >
        {status === "connected" && "🟢 Connected"}
        {status === "connecting" && "🟡 Connecting..."}
        {status === "disconnected" && "⚫ Disconnected"}
        {status === "error" && "🔴 Error"}
      </div>

      {children}

      {/* Debug info (remove in production) */}
      {error && (
        <div className="hidden text-xs text-rose-600">
          WebSocket Error: {error.message}
        </div>
      )}
    </>
  );
}
