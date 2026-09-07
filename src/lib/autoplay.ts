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

function dirBetween(from: Point, to: Point): Direction | null {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (dx === 1 && dy === 0) return "right";
  if (dx === -1 && dy === 0) return "left";
  if (dy === 1 && dx === 0) return "down";
  if (dy === -1 && dx === 0) return "up";
  return null;
}

function cellKey(p: Point) {
  return `${p.x},${p.y}`;
}

function manhattan(a: Point, b: Point) {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

function willGrow(state: GameState, cell: Point) {
  if (state.pendingGrow > 0) return true;
  return state.foods.some((food) => food.x === cell.x && food.y === cell.y);
}

function isOccupied(state: GameState, cell: Point, growing: boolean) {
  return state.snake.some((part, i) => {
    if (!growing && i === state.snake.length - 1) return false;
    return part.x === cell.x && part.y === cell.y;
  });
}

function nearestFood(state: GameState, from: Point) {
  let best: Point | null = null;
  let bestDist = Infinity;
  for (const food of state.foods) {
    const dist = manhattan(from, food);
    if (dist < bestDist) {
      bestDist = dist;
      best = food;
    }
  }
  return best ? { food: best, dist: bestDist } : null;
}

function blockedCells(state: GameState, growing: boolean) {
  const blocked = new Set<string>();
  const tail = state.snake.length - 1;
  for (let i = 0; i < state.snake.length; i += 1) {
    if (!growing && i === tail) continue;
    blocked.add(cellKey(state.snake[i]));
  }
  return blocked;
}

function leftoverSafe(state: GameState, cell: Point) {
  const growing = willGrow(state, cell);
  if (isOccupied(state, cell, growing)) return false;
  const blocked = blockedCells(state, growing);
  const tail = state.snake[state.snake.length - 1];
  const seen = new Set<string>([cellKey(cell)]);
  const queue: Point[] = [cell];
  let reachesTail = !growing && cell.x === tail.x && cell.y === tail.y;

  while (queue.length) {
    const cur = queue.pop()!;
    if (manhattan(cur, tail) === 1) reachesTail = true;
    if (!growing && cur.x === tail.x && cur.y === tail.y) reachesTail = true;
    for (const dir of DIRS) {
      const next = { x: cur.x + DELTA[dir].x, y: cur.y + DELTA[dir].y };
      if (next.x < 0 || next.y < 0 || next.x >= state.cols || next.y >= state.rows) continue;
      const id = cellKey(next);
      if (seen.has(id) || blocked.has(id)) continue;
      seen.add(id);
      queue.push(next);
    }
  }

  const need = state.snake.length + (growing ? 1 : 0);
  return reachesTail && seen.size >= need;
}

export function pickAutoplayDir(state: GameState): Direction {
  const facing = state.queued.at(-1) ?? state.direction;
  const head = state.snake[0];
  const nxt = state.cycleNext[head.y]?.[head.x];
  const cycleDir = (nxt && dirBetween(head, nxt)) || facing;
  if (!nxt) return facing;

  const fill = state.snake.length / (state.cols * state.rows);
  if (fill >= 0.58) return cycleDir;

  const target = nearestFood(state, head);
  if (!target) return cycleDir;

  let best: Direction | null = null;
  let bestScore = Infinity;

  for (const dir of DIRS) {
    if (dir === OPPOSITE[state.direction]) continue;
    const cell = { x: head.x + DELTA[dir].x, y: head.y + DELTA[dir].y };
    if (cell.x < 0 || cell.y < 0 || cell.x >= state.cols || cell.y >= state.rows) continue;
    if (!leftoverSafe(state, cell)) continue;

    const dist = manhattan(cell, target.food);
    if (dist >= target.dist && dir !== cycleDir) continue;

    const score = dist * 10 + (dir === cycleDir ? 1 : 0);
    if (score < bestScore) {
      bestScore = score;
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
