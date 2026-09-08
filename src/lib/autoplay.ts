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
const MAX_POCKET = 24;
const EARLY_FILL = 0.32;
const LOCAL_RANGE = 5;
const CLUSTER_STEP = 3;

function dirBetween(from: Point, to: Point): Direction | null {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (dx === 1 && dy === 0) return "right";
  if (dx === -1 && dy === 0) return "left";
  if (dy === 1 && dx === 0) return "down";
  if (dy === -1 && dx === 0) return "up";
  return null;
}

function fwd(from: number, to: number, n: number) {
  return (to - from + n) % n;
}

function manhattan(a: Point, b: Point) {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

function keyOf(p: Point) {
  return `${p.x},${p.y}`;
}

function inBounds(state: GameState, p: Point) {
  return p.x >= 0 && p.y >= 0 && p.x < state.cols && p.y < state.rows;
}

function isFood(state: GameState, cell: Point) {
  return state.foods.some((food) => food.x === cell.x && food.y === cell.y);
}

function snakeKeys(state: GameState, growing: boolean) {
  const keys = new Set<string>();
  const last = state.snake.length - 1;
  for (let i = 0; i < state.snake.length; i += 1) {
    if (!growing && i === last) continue;
    keys.add(keyOf(state.snake[i]));
  }
  return keys;
}

function isClear(state: GameState, cell: Point, blocked: Set<string>) {
  return inBounds(state, cell) && !blocked.has(keyOf(cell));
}

function aheadOfTail(
  headI: number,
  cellI: number,
  tailI: number,
  n: number,
  growing: boolean,
) {
  const distNext = fwd(headI, cellI, n);
  const distTail = fwd(headI, tailI, n);
  if (distNext === 0) return false;
  return growing ? distNext < distTail : distNext <= distTail;
}

function nearApple(state: GameState, p: Point) {
  return state.foods.some((food) => manhattan(food, p) <= 2);
}

function floodPocket(state: GameState, start: Point, blocked: Set<string>) {
  const cells: Point[] = [];
  const seen = new Set<string>([keyOf(start)]);
  const q = [start];
  while (q.length) {
    const cur = q.pop()!;
    cells.push(cur);
    if (cells.length > MAX_POCKET) return null;
    for (const dir of DIRS) {
      const nxt = { x: cur.x + DELTA[dir].x, y: cur.y + DELTA[dir].y };
      const id = keyOf(nxt);
      if (seen.has(id) || !isClear(state, nxt, blocked)) continue;
      if (!isFood(state, nxt) && !nearApple(state, nxt)) continue;
      seen.add(id);
      q.push(nxt);
    }
  }
  return { cells, seen };
}

function pocketShape(cells: Point[]) {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const p of cells) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  return { w: maxX - minX + 1, h: maxY - minY + 1 };
}

function pocketExits(state: GameState, seen: Set<string>, blocked: Set<string>, head: Point) {
  let exits = 0;
  for (const id of seen) {
    const [xs, ys] = id.split(",");
    const p = { x: Number(xs), y: Number(ys) };
    for (const dir of DIRS) {
      const n = { x: p.x + DELTA[dir].x, y: p.y + DELTA[dir].y };
      if (!inBounds(state, n)) continue;
      if (seen.has(keyOf(n))) continue;
      if (n.x === head.x && n.y === head.y) continue;
      if (blocked.has(keyOf(n))) continue;
      exits += 1;
    }
  }
  return exits;
}

function applesIn(state: GameState, seen: Set<string>) {
  return state.foods.filter((food) => seen.has(keyOf(food)));
}

function canFillPocket(
  state: GameState,
  start: Point,
  blocked: Set<string>,
  head: Point,
) {
  const flood = floodPocket(state, start, blocked);
  if (!flood) return null;
  const apples = applesIn(state, flood.seen);
  if (apples.length === 0) return null;
  const { w, h } = pocketShape(flood.cells);
  const exits = pocketExits(state, flood.seen, blocked, head);
  const thin = Math.min(w, h) === 1;
  if (thin && exits === 0) return null;
  return { apples: apples.length, size: flood.cells.length, seen: flood.seen };
}

function densestApple(state: GameState) {
  if (state.foods.length === 0) return null;
  let best = state.foods[0];
  let bestCount = -1;
  for (const food of state.foods) {
    const count = state.foods.filter((other) => manhattan(food, other) <= 4).length;
    if (count > bestCount) {
      best = food;
      bestCount = count;
    }
  }
  return best;
}

function localAppleCount(state: GameState, from: Point) {
  return state.foods.filter((food) => manhattan(from, food) <= LOCAL_RANGE).length;
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

  const fill = state.snake.length / n;
  const growing = state.pendingGrow > 0;
  const blocked = snakeKeys(state, growing);

  type PocketMove = { dir: Direction; apples: number; size: number; food: boolean };
  let pocket: PocketMove | null = null;

  for (const dir of DIRS) {
    if (dir === OPPOSITE[state.direction]) continue;
    const cell = { x: head.x + DELTA[dir].x, y: head.y + DELTA[dir].y };
    if (!isClear(state, cell, blocked)) continue;
    const cellI = state.cycleIndex[cell.y]?.[cell.x];
    if (cellI == null || cellI < 0) continue;
    const willEat = isFood(state, cell);
    if (!aheadOfTail(headI, cellI, tailI, n, growing || willEat)) continue;
    const info = canFillPocket(state, cell, blocked, head);
    if (!info) continue;
    const better =
      !pocket ||
      info.apples > pocket.apples ||
      (info.apples === pocket.apples && (willEat && !pocket.food || info.size < pocket.size));
    if (better) {
      pocket = { dir, apples: info.apples, size: info.size, food: willEat };
    }
  }

  if (pocket && pocket.apples > 0) return pocket.dir;

  let eat: Direction | null = null;
  let eatAlong = Infinity;
  for (const dir of DIRS) {
    if (dir === OPPOSITE[state.direction]) continue;
    const cell = { x: head.x + DELTA[dir].x, y: head.y + DELTA[dir].y };
    if (!isClear(state, cell, blocked) || !isFood(state, cell)) continue;
    const cellI = state.cycleIndex[cell.y]?.[cell.x];
    if (cellI == null || cellI < 0) continue;
    if (!aheadOfTail(headI, cellI, tailI, n, true)) continue;
    const along = fwd(headI, cellI, n);
    if (along < eatAlong) {
      eatAlong = along;
      eat = dir;
    }
  }
  if (eat) return eat;

  const cluster = densestApple(state);
  if (cluster && fill < EARLY_FILL && localAppleCount(state, head) <= 1) {
    let seek: Direction | null = null;
    let bestMan = manhattan(head, cluster);
    for (const dir of DIRS) {
      if (dir === OPPOSITE[state.direction]) continue;
      const cell = { x: head.x + DELTA[dir].x, y: head.y + DELTA[dir].y };
      if (!isClear(state, cell, blocked)) continue;
      const cellI = state.cycleIndex[cell.y]?.[cell.x];
      if (cellI == null || cellI < 0) continue;
      const distNext = fwd(headI, cellI, n);
      if (distNext === 0 || distNext > CLUSTER_STEP) continue;
      if (!aheadOfTail(headI, cellI, tailI, n, growing || isFood(state, cell))) continue;
      const man = manhattan(cell, cluster);
      if (man < bestMan) {
        bestMan = man;
        seek = dir;
      }
    }
    if (seek) return seek;
  }

  return cycleDir;
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
