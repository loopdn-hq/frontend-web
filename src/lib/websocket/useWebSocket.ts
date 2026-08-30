"use client";

import { useEffect, useRef, useState, useCallback } from "react";

type WebSocketMessage = {
  type: "message" | "system" | "member_join" | "member_leave" | "error";
  data: Record<string, unknown>;
};

type UseWebSocketOptions = {
  url: string;
  enabled?: boolean;
  onMessage?: (message: WebSocketMessage) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: Error) => void;
  reconnectAttempts?: number;
  reconnectDelay?: number;
};

type WebSocketStatus =
  "connecting" | "connected" | "disconnecting" | "disconnected" | "error";

export function useWebSocket({
  url,
  enabled = true,
  onMessage,
  onConnect,
  onDisconnect,
  onError,
  reconnectAttempts = 5,
  reconnectDelay = 3000,
}: UseWebSocketOptions) {
  const ws = useRef<WebSocket | null>(null);
  const [status, setStatus] = useState<WebSocketStatus>("disconnected");
  const [error, setError] = useState<Error | null>(null);
  const reconnectCountRef = useRef(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const connect = useCallback(() => {
    if (!enabled || !url) {
      return;
    }

    if (
      ws.current?.readyState === WebSocket.OPEN ||
      ws.current?.readyState === WebSocket.CONNECTING
    ) {
      return;
    }

    setStatus("connecting");
    setError(null);

    try {
      ws.current = new WebSocket(url);

      ws.current.onopen = () => {
        console.log("[WebSocket] Connected to", url);
        setStatus("connected");
        setError(null);
        reconnectCountRef.current = 0;
        onConnect?.();
      };

      ws.current.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data) as WebSocketMessage;
          console.log("[WebSocket] Message received:", message);
          onMessage?.(message);
        } catch (err) {
          console.error("[WebSocket] Failed to parse message:", err);
        }
      };

      ws.current.onerror = (event) => {
        console.error("[WebSocket] Error:", event);
        const error = new Error("WebSocket error occurred");
        setStatus("error");
        setError(error);
        onError?.(error);
      };

      ws.current.onclose = () => {
        console.log("[WebSocket] Connection closed");
        setStatus("disconnected");
        onDisconnect?.();

        // Attempt to reconnect
        if (reconnectCountRef.current < reconnectAttempts) {
          reconnectCountRef.current += 1;
          console.log(
            `[WebSocket] Reconnecting... (attempt ${reconnectCountRef.current}/${reconnectAttempts})`,
          );

          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, reconnectDelay);
        }
      };
    } catch (err) {
      const error =
        err instanceof Error ? err : new Error("Failed to create WebSocket");
      console.error("[WebSocket] Connection error:", error);
      setStatus("error");
      setError(error);
      onError?.(error);
    }
  }, [
    url,
    enabled,
    onConnect,
    onDisconnect,
    onError,
    onMessage,
    reconnectAttempts,
    reconnectDelay,
  ]);

  const disconnect = useCallback(() => {
    setStatus("disconnecting");

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (ws.current) {
      ws.current.close();
      ws.current = null;
    }

    setStatus("disconnected");
  }, []);

  const send = useCallback(
    (message: WebSocketMessage) => {
      if (ws.current?.readyState === WebSocket.OPEN) {
        try {
          ws.current.send(JSON.stringify(message));
          console.log("[WebSocket] Message sent:", message);
        } catch (err) {
          console.error("[WebSocket] Failed to send message:", err);
          const error =
            err instanceof Error ? err : new Error("Failed to send message");
          setError(error);
          onError?.(error);
        }
      } else {
        console.warn("[WebSocket] Cannot send message - connection not ready");
        const error = new Error("WebSocket connection not ready");
        setError(error);
        onError?.(error);
      }
    },
    [onError],
  );

  useEffect(() => {
    if (!enabled || !url) {
      setStatus("disconnected");
      return;
    }

    connect();

    return () => {
      disconnect();
    };
  }, [connect, disconnect, enabled, url]);

  return {
    status,
    error,
    send,
    disconnect,
    reconnect: connect,
    isConnected: status === "connected",
  };
}
