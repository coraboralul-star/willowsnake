"use client";

import { OPPOSITE, type Direction, type GameState } from "@/lib/engine";

let autoplayOn = false;

export function isAutoplay() {
  return autoplayOn;
}

export function enableAutoplay() {
  autoplayOn = true;
}

export function autoplayOnNewRun(_tickMs = 100) {}

function dirBetween(from: { x: number; y: number }, to: { x: number; y: number }): Direction | null {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (dx === 1 && dy === 0) return "right";
  if (dx === -1 && dy === 0) return "left";
  if (dy === 1 && dx === 0) return "down";
  if (dy === -1 && dx === 0) return "up";
  return null;
}

export function pickAutoplayDir(state: GameState): Direction {
  const head = state.snake[0];
  const nxt = state.cycleNext[head.y]?.[head.x];
  if (!nxt) return state.direction;
  return dirBetween(head, nxt) ?? state.direction;
}

export function applyAutoplayDir(state: GameState, dir: Direction): GameState {
  if (dir === OPPOSITE[state.direction] || dir === state.direction) {
    return { ...state, queued: [] };
  }
  return { ...state, queued: [dir] };
}

export const DIR_TO_KEY = {
  up: "w",
  down: "s",
  left: "a",
  right: "d",
} as const;
