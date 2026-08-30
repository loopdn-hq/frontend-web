"use client";

import {
  createContext,
  useContext,
  ReactNode,
  useState,
  useCallback,
} from "react";

type LoopWebSocketContextType = {
  connectToLoop: (loopId: string | number) => void;
  disconnectFromLoop: (loopId: string | number) => void;
  sendMessage: (loopId: string | number, message: string) => void;
  getLoopStatus: (loopId: string | number) => string;
  getLoopError: (loopId: string | number) => Error | null;
  currentLoopId: string | number | null;
};

const LoopWebSocketContext = createContext<
  LoopWebSocketContextType | undefined
>(undefined);

type LoopConnection = {
  loopId: string | number;
  status: string;
  error: Error | null;
};

export function LoopWebSocketProvider({ children }: { children: ReactNode }) {
  const [currentLoopId, setCurrentLoopId] = useState<string | number | null>(
    null,
  );
  const [connections, setConnections] = useState<
    Map<string | number, LoopConnection>
  >(new Map());

  const connectToLoop = useCallback((loopId: string | number) => {
    console.log(`[LoopWebSocket] Connecting to loop ${loopId}`);
    setCurrentLoopId(loopId);

    // Update connection status
    setConnections((prev) => {
      const map = new Map(prev);
      const existing = map.get(loopId) || {
        loopId,
        status: "disconnected",
        error: null,
      };
      map.set(loopId, { ...existing, status: "connecting" });
      return map;
    });
  }, []);

  const disconnectFromLoop = useCallback(
    (loopId: string | number) => {
      console.log(`[LoopWebSocket] Disconnecting from loop ${loopId}`);
      if (currentLoopId === loopId) {
        setCurrentLoopId(null);
      }

      // Update connection status
      setConnections((prev) => {
        const map = new Map(prev);
        const existing = map.get(loopId);
        if (existing) {
          map.set(loopId, { ...existing, status: "disconnected" });
        }
        return map;
      });
    },
    [currentLoopId],
  );

  const sendMessage = useCallback(
    (loopId: string | number, message: string) => {
      console.log(
        `[LoopWebSocket] Sending message to loop ${loopId}:`,
        message,
      );
      // This will be implemented through the actual WebSocket connection
      // For now, this is a placeholder
    },
    [],
  );

  const getLoopStatus = useCallback(
    (loopId: string | number) => {
      return connections.get(loopId)?.status || "disconnected";
    },
    [connections],
  );

  const getLoopError = useCallback(
    (loopId: string | number) => {
      return connections.get(loopId)?.error || null;
    },
    [connections],
  );

  return (
    <LoopWebSocketContext.Provider
      value={{
        connectToLoop,
        disconnectFromLoop,
        sendMessage,
        getLoopStatus,
        getLoopError,
        currentLoopId,
      }}
    >
      {children}
    </LoopWebSocketContext.Provider>
  );
}

export function useLoopWebSocket() {
  const context = useContext(LoopWebSocketContext);
  if (!context) {
    throw new Error(
      "useLoopWebSocket must be used within LoopWebSocketProvider",
    );
  }
  return context;
}
