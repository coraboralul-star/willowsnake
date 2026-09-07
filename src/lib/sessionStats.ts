"use client";

export type SessionStats = {
  attempts: number;
  wins: number;
  deaths: number;
};

const EMPTY: SessionStats = { attempts: 0, wins: 0, deaths: 0 };

let stats: SessionStats = EMPTY;
const listeners = new Set<() => void>();

function emit() {
  for (const fn of listeners) fn();
}

export function getSessionStats() {
  return stats;
}

export function bumpAttempt() {
  stats = { ...stats, attempts: stats.attempts + 1 };
  emit();
}

export function bumpWin() {
  stats = { ...stats, wins: stats.wins + 1 };
  emit();
}

export function bumpDeath() {
  stats = { ...stats, deaths: stats.deaths + 1 };
  emit();
}

export function subscribeSessionStats(onChange: () => void) {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}
