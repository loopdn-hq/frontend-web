"use client";

import { useEffect } from "react";
import { useWebSocket } from "@/lib/websocket/useWebSocket";

type WebSocketMessage = {
  type: "message" | "system" | "member_join" | "member_leave" | "error";
  data: Record<string, unknown>;
};

type LoopWebSocketManagerProps = {
  loopId: string | number;
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
  loopId,
  onMessage,
  onConnected,
  onDisconnected,
  onError,
  children,
}: LoopWebSocketManagerProps) {
  const protocol =
    typeof window !== "undefined" && window.location.protocol === "https:"
      ? "wss:"
      : "ws:";
  const host =
    typeof window !== "undefined" ? window.location.host : "localhost:8000";
  const wsHost = process.env.NEXT_PUBLIC_WS_HOST || host;
  const url = `${protocol}//${wsHost}/ws/loop/${loopId}/`;

  // No backend WebSocket server configured yet — skip connecting so we don't
  // spam the console with errors/reconnect attempts against nothing.
  const wsEnabled = Boolean(process.env.NEXT_PUBLIC_WS_HOST);

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
