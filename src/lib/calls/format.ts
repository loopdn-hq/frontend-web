"use client";

import { useEffect, useState } from "react";

/** 75 -> "1:15", 3725 -> "1:02:05". */
export function formatCallDuration(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = String(seconds % 60).padStart(2, "0");
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${rest}`
    : `${minutes}:${rest}`;
}

/** Seconds since `since`, ticking once a second. Null while `since` is null. */
export function useElapsedSeconds(since: string | null): number | null {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!since) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [since]);

  if (!since) return null;
  const started = Date.parse(since);
  return Number.isNaN(started) ? null : Math.max(0, (now - started) / 1000);
}
