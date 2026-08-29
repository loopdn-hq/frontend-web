"use client";

import { useEffect, useState, useCallback } from "react";
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

export function LoopWebSocketManager({
  loopId,
  onMessage,
  onConnected,
  onDisconnected,
  onError,
  children,
}: LoopWebSocketManagerProps) {
  // Build WebSocket URL
  const getWebSocketUrl = useCallback(() => {
    const protocol = typeof window !== "undefined" && window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = typeof window !== "undefined" ? window.location.host : "localhost:8000";
    const wsHost = process.env.NEXT_PUBLIC_WS_HOST || host;
    return `${protocol}//${wsHost}/ws/loop/${loopId}/`;
  }, [loopId]);

  const [url, setUrl] = useState<string>("");

  useEffect(() => {
    setUrl(getWebSocketUrl());
  }, [getWebSocketUrl]);

  // No backend WebSocket server configured yet — skip connecting so we don't
  // spam the console with errors/reconnect attempts against nothing.
  const wsEnabled = Boolean(process.env.NEXT_PUBLIC_WS_HOST);

  const { status, error, send, isConnected } = useWebSocket({
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
      (window as any).__loopWSSend = send;
      (window as any).__loopWSStatus = status;
    }

    return () => {
      if (typeof window !== "undefined") {
        delete (window as any).__loopWSSend;
        delete (window as any).__loopWSStatus;
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
      <div className={`hidden text-xs font-semibold px-2 py-1 rounded ${statusColor}`}>
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
