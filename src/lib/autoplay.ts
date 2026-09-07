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

const DIRS: Direction[] = ["up", "down", "left", "right"];
const CLUSTER = 4;

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

function clusterFood(state: GameState, from: Point) {
  if (state.foods.length === 0) return null;
  let best = state.foods[0];
  let bestCount = -1;
  let bestDist = Infinity;
  for (const food of state.foods) {
    const count = state.foods.filter((other) => manhattan(food, other) <= CLUSTER).length;
    const dist = manhattan(from, food);
    if (count > bestCount || (count === bestCount && dist < bestDist)) {
      best = food;
      bestCount = count;
      bestDist = dist;
    }
  }
  return best;
}

function nearbyCleanFood(state: GameState, from: Point, headI: number, n: number) {
  let best: Point | null = null;
  let bestDist = Infinity;
  for (const food of state.foods) {
    const foodI = state.cycleIndex[food.y]?.[food.x];
    if (foodI == null || foodI < 0) continue;
    const along = fwd(headI, foodI, n);
    const manh = manhattan(from, food);
    if (manh > 3 || along === 0 || along > 8) continue;
    if (manh < bestDist) {
      bestDist = manh;
      best = food;
    }
  }
  return best;
}

export function pickAutoplayDir(state: GameState): Direction {
  const facing = state.queued.at(-1) ?? state.direction;
  const head = state.snake[0];
  const tail = state.snake[state.snake.length - 1];
  const nxt = state.cycleNext[head.y]?.[head.x];
  const cycleDir = (nxt && dirBetween(head, nxt)) || facing;
  if (!nxt) return facing;

  const n = state.cols * state.rows;
  const fill = state.snake.length / n;
  if (fill >= 0.62) return cycleDir;

  const headI = state.cycleIndex[head.y]?.[head.x];
  const tailI = state.cycleIndex[tail.y]?.[tail.x];
  if (headI == null || tailI == null || headI < 0 || tailI < 0) return cycleDir;

  const inCluster = state.foods.some((food) => manhattan(head, food) <= CLUSTER);
  const target = inCluster
    ? nearbyCleanFood(state, head, headI, n) ?? clusterFood(state, head)
    : clusterFood(state, head);
  if (!target) return cycleDir;

  const targetI = state.cycleIndex[target.y]?.[target.x];
  if (targetI == null || targetI < 0) return cycleDir;

  const distApple = fwd(headI, targetI, n);
  const distTail = fwd(headI, tailI, n);
  const maxJump = inCluster ? Math.min(distApple, 8) : distApple;
  let best: Direction | null = null;
  let bestLeft = Infinity;

  for (const dir of DIRS) {
    if (dir === OPPOSITE[state.direction]) continue;
    const cell = { x: head.x + DELTA[dir].x, y: head.y + DELTA[dir].y };
    if (cell.x < 0 || cell.y < 0 || cell.x >= state.cols || cell.y >= state.rows) continue;
    const growing = willGrow(state, cell);
    const blocked = state.snake.some((part, i) => {
      if (!growing && i === state.snake.length - 1) return false;
      return part.x === cell.x && part.y === cell.y;
    });
    if (blocked) continue;

    const cellI = state.cycleIndex[cell.y]?.[cell.x];
    if (cellI == null || cellI < 0) continue;
    const distNext = fwd(headI, cellI, n);
    if (distNext === 0 || distNext > maxJump) continue;
    if (growing ? distNext >= distTail : distNext > distTail) continue;

    const left = fwd(cellI, targetI, n);
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
