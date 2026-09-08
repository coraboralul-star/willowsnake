"use client";

import {
  DELTA,
  OPPOSITE,
  type Direction,
  type GameState,
  type Point,
} from "@/lib/engine";

let autoplayOn = false;

export function isAutoplay() {
  return autoplayOn;
}

export function enableAutoplay() {
  autoplayOn = true;
}

export function autoplayOnNewRun(_tickMs = 104) {}

const DIRS: Direction[] = ["up", "down", "left", "right"];

function dirBetween(from: Point, to: Point): Direction | null {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (dx === 1 && dy === 0) return "right";
  if (dx === -1 && dy === 0) return "left";
  if (dy === 1 && dx === 0) return "down";
  if (dy === -1 && dx === 0) return "up";
  return null;
}

function manhattan(a: Point, b: Point) {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

function fwd(from: number, to: number, n: number) {
  return (to - from + n) % n;
}

function willGrow(state: GameState, cell: Point) {
  if (state.pendingGrow > 0) return true;
  return state.foods.some((food) => food.x === cell.x && food.y === cell.y);
}

function isClear(state: GameState, cell: Point, growing: boolean) {
  return !state.snake.some((part, i) => {
    if (!growing && i === state.snake.length - 1) return false;
    return part.x === cell.x && part.y === cell.y;
  });
}

export function pickAutoplayDir(state: GameState): Direction {
  const facing = state.queued.at(-1) ?? state.direction;
  const head = state.snake[0];
  const tail = state.snake[state.snake.length - 1];
  const nxt = state.cycleNext[head.y]?.[head.x];
  const cycleDir = (nxt && dirBetween(head, nxt)) || facing;
  if (!nxt) return facing;

  const n = state.cols * state.rows;
  const headI = state.cycleIndex[head.y]?.[head.x];
  const tailI = state.cycleIndex[tail.y]?.[tail.x];
  if (headI == null || tailI == null || headI < 0 || tailI < 0) return cycleDir;

  const distTail = fwd(headI, tailI, n);
  type Target = { food: Point; along: number; man: number };
  const targets: Target[] = [];
  for (const food of state.foods) {
    const appleI = state.cycleIndex[food.y]?.[food.x];
    if (appleI == null || appleI < 0) continue;
    const along = fwd(headI, appleI, n);
    if (along === 0 || along >= distTail) continue;
    targets.push({ food, along, man: manhattan(head, food) });
  }
  if (targets.length === 0) return cycleDir;

  targets.sort((a, b) => {
    const rank = (t: Target) => (t.man <= 1 ? 0 : t.man <= 2 ? 1 : t.man <= 4 ? 2 : 3);
    const ra = rank(a);
    const rb = rank(b);
    if (ra !== rb) return ra - rb;
    return a.along - b.along;
  });
  const apple = targets[0];
  const skip = apple.man <= 2 ? distTail : apple.man <= 4 ? Math.min(distTail, 80) : Math.min(distTail - 1, 32);

  let best: Direction | null = null;
  let bestLeft = apple.along;

  for (const dir of DIRS) {
    if (dir === OPPOSITE[state.direction]) continue;
    const cell = { x: head.x + DELTA[dir].x, y: head.y + DELTA[dir].y };
    if (cell.x < 0 || cell.y < 0 || cell.x >= state.cols || cell.y >= state.rows) continue;
    const growing = willGrow(state, cell);
    if (!isClear(state, cell, growing)) continue;

    const cellI = state.cycleIndex[cell.y]?.[cell.x];
    if (cellI == null || cellI < 0) continue;
    const distNext = fwd(headI, cellI, n);
    if (distNext === 0 || distNext > skip) continue;
    if (growing ? distNext >= distTail : distNext > distTail) continue;

    const left = fwd(cellI, state.cycleIndex[apple.food.y][apple.food.x], n);
    if (left < bestLeft) {
      bestLeft = left;
      best = dir;
    }
  }

  return best ?? cycleDir;
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

function isDeadly(state: GameState, dir: Direction) {
  const head = state.snake[0];
  const next = { x: head.x + DELTA[dir].x, y: head.y + DELTA[dir].y };
  if (next.x < 0 || next.y < 0 || next.x >= state.cols || next.y >= state.rows) return true;
  return state.snake.some((part) => part.x === next.x && part.y === next.y);
}

export function pickHijackDir(state: GameState, now: number): Direction {
  const deadly = DIRS.filter((dir) => isDeadly(state, dir));
  const safe = DIRS.filter(
    (dir) => dir !== OPPOSITE[state.direction] && !isDeadly(state, dir),
  );
  if (deadly.length > 0 && Math.random() < hijackKillChance(state, now)) {
    return deadly[Math.floor(Math.random() * deadly.length)];
  }
  if (safe.length > 0) return safe[Math.floor(Math.random() * safe.length)];
  return state.direction;
}

function hijackKillChance(state: GameState, now: number) {
  const started = state.hijackStartedAt;
  const until = state.hijackUntil;
  if (!started || !until || until <= started) return 0;
  const span = until - started;
  const elapsed = now - started;
  const safeUntil = span * 0.78;
  if (elapsed < safeUntil) return 0;
  const t = Math.min(1, (elapsed - safeUntil) / Math.max(1, span - safeUntil));
  return 0.00001 + t * t * 0.008;
}

export const DIR_TO_KEY = {
  up: "w",
  down: "s",
  left: "a",
  right: "d",
} as const;