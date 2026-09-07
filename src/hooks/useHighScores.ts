"use client";

import { useCallback, useSyncExternalStore } from "react";

const STORAGE_KEY = "willow-snake-best";
const EVENT = "willow-scores";

export function useHighScores() {
  const raw = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const best = parseBest(raw);

  const record = useCallback((score: number) => {
    const next = Math.max(parseBest(getSnapshot()), score);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ board: next }));
      window.dispatchEvent(new Event(EVENT));
    } catch {
      // Ignore private-mode write failures.
    }
  }, []);

  return { best, record };
}

function subscribe(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(EVENT, onStoreChange);
  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(EVENT, onStoreChange);
  };
}

function getSnapshot() {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? "{}";
  } catch {
    return "{}";
  }
}

function getServerSnapshot() {
  return "{}";
}

function parseBest(raw: string): number {
  try {
    const data = JSON.parse(raw) as unknown;
    if (typeof data === "number") return data;
    if (data && typeof data === "object") {
      return Math.max(
        0,
        ...Object.values(data as Record<string, unknown>).map((value) => Number(value) || 0),
      );
    }
  } catch {
    // Ignore broken localStorage payloads.
  }
  return 0;
}
