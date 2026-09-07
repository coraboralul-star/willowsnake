"use client";

import { OPPOSITE, type Direction, type GameState, type Point } from "@/lib/engine";

const DIRS: Direction[] = ["up", "right", "down", "left"];
const DELTA: Record<Direction, Point> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

let autoplayOn = false;

export function isAutoplay() {
  return autoplayOn;
}

export function enableAutoplay() {
  autoplayOn = true;
}

export function autoplayOnNewRun(_tickMs = 100) {}

function dirBetween(from: Point, to: Point): Direction | null {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (dx === 1 && dy === 0) return "right";
  if (dx === -1 && dy === 0) return "left";
  if (dy === 1 && dx === 0) return "down";
  if (dy === -1 && dx === 0) return "up";
  return null;
}

function cycleDist(from: number, to: number, len: number) {
  return (to - from + len) % len;
}

function inSafeArc(state: GameState, cell: Point) {
  const head = state.snake[0];
  const tail = state.snake[state.snake.length - 1];
  const len = state.gridSize * state.gridSize;
  const H = state.cycleIndex[head.y][head.x];
  const T = state.cycleIndex[tail.y][tail.x];
  const I = state.cycleIndex[cell.y][cell.x];
  const toCell = cycleDist(H, I, len);
  const toTail = cycleDist(H, T, len);
  return toCell > 0 && toCell < toTail;
}

function occupied(state: GameState) {
  return new Set(state.snake.slice(0, -1).map((p) => `${p.x},${p.y}`));
}

function canResume(state: GameState, cell: Point, facing: Direction) {
  const nxt = state.cycleNext[cell.y][cell.x];
  const resume = dirBetween(cell, nxt);
  return resume != null && resume !== OPPOSITE[facing];
}

function shortcutStep(state: GameState, facing: Direction): Direction | null {
  const n = state.gridSize;
  const head = state.snake[0];
  const blocked = occupied(state);

  for (const dir of DIRS) {
    if (dir === OPPOSITE[facing]) continue;
    const nxt = { x: head.x + DELTA[dir].x, y: head.y + DELTA[dir].y };
    if (nxt.x < 0 || nxt.y < 0 || nxt.x >= n || nxt.y >= n) continue;
    const isFood = state.foods.some((food) => food.x === nxt.x && food.y === nxt.y);
    if (!isFood || blocked.has(`${nxt.x},${nxt.y}`)) continue;
    if (!inSafeArc(state, nxt)) continue;
    if (!canResume(state, nxt, dir)) continue;
    return dir;
  }
  return null;
}

export function pickAutoplayDir(state: GameState): Direction {
  const facing = state.queued.at(-1) ?? state.direction;
  const cut = shortcutStep(state, facing);
  if (cut) return cut;

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

export const DIR_TO_KEY = {
  up: "w",
  down: "s",
  left: "a",
  right: "d",
} as const;
