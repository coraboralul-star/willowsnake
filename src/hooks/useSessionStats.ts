"use client";

import { useSyncExternalStore } from "react";
import {
  getSessionStats,
  subscribeSessionStats,
  type SessionStats,
} from "@/lib/sessionStats";

const EMPTY: SessionStats = { attempts: 0, wins: 0, deaths: 0 };

export function useSessionStats() {
  return useSyncExternalStore(subscribeSessionStats, getSessionStats, () => EMPTY);
}
