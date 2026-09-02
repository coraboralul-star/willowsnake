"use client";

import { useCallback, useSyncExternalStore } from "react";
import type { GridId } from "@/lib/engine";

const STORAGE_KEY = "willow-snake-best";
const EVENT = "willow-scores";

type ScoreMap = Partial<Record<GridId, number>>;

export function useHighScores() {
  const raw = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const scores = parseScores(raw);

  const record = useCallback((gridId: GridId, score: number) => {
    const current = parseScores(getSnapshot());
    const next = { ...current, [gridId]: Math.max(current[gridId] ?? 0, score) };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      window.dispatchEvent(new Event(EVENT));
    } catch {
      // Ignore private-mode write failures.
    }
  }, []);

  return { scores, record };
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

function parseScores(raw: string): ScoreMap {
  try {
    return JSON.parse(raw) as ScoreMap;
  } catch {
    return {};
  }
}
