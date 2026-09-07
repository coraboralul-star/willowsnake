"use client";

import { DELTA, OPPOSITE, type Direction, type GameState, type Point } from "@/lib/engine";

let autoplayOn = false;

export function isAutoplay() {
  return autoplayOn;
}

export function enableAutoplay() {
  autoplayOn = true;
}

export function autoplayOnNewRun(_tickMs = 114) {}

function dirBetween(from: Point, to: Point): Direction | null {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (dx === 1 && dy === 0) return "right";
  if (dx === -1 && dy === 0) return "left";
  if (dy === 1 && dx === 0) return "down";
  if (dy === -1 && dx === 0) return "up";
  return null;
}

export function pickAutoplayDir(state: GameState): Direction {
  const facing = state.queued.at(-1) ?? state.direction;
  const head = state.snake[0];
  const nxt = state.cycleNext[head.y]?.[head.x];
  if (!nxt) return facing;
  return dirBetween(head, nxt) ?? facing;
}

export function applyAutoplayDir(state: GameState, dir: Direction): GameState {
  if (dir === OPPOSITE[state.direction] || dir === state.direction) {
    return { ...state, queued: [] };
  }
  return { ...state, queued: [dir] };
}

export function applyHijackDir(state: GameState, dir: Direction): GameState {
  return { ...state, queued: [], direction: dir };
}

const HIJACK_DIRS: Direction[] = ["up", "down", "left", "right"];

function isDeadly(state: GameState, dir: Direction) {
  const head = state.snake[0];
  const next = { x: head.x + DELTA[dir].x, y: head.y + DELTA[dir].y };
  if (next.x < 0 || next.y < 0 || next.x >= state.cols || next.y >= state.rows) return true;
  return state.snake.some((part) => part.x === next.x && part.y === next.y);
}

export function pickHijackDir(state: GameState): Direction {
  if (Math.random() < 0.01) {
    const deadly = HIJACK_DIRS.filter((dir) => isDeadly(state, dir));
    if (deadly.length > 0) return deadly[Math.floor(Math.random() * deadly.length)];
  }
  const wander = HIJACK_DIRS.filter((dir) => dir !== OPPOSITE[state.direction]);
  return wander[Math.floor(Math.random() * wander.length)] ?? state.direction;
}

export const DIR_TO_KEY = {
  up: "w",
  down: "s",
  left: "a",
  right: "d",
} as const;
