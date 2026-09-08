"use client";

import {
  BASE_TICK,
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

export function autoplayOnNewRun(_tickMs = BASE_TICK) {}

const DIRS: Direction[] = ["up", "down", "left", "right"];

function keyOf(p: Point) {
  return `${p.x},${p.y}`;
}

function eq(a: Point, b: Point) {
  return a.x === b.x && a.y === b.y;
}

function cellAt(from: Point, dir: Direction): Point {
  return { x: from.x + DELTA[dir].x, y: from.y + DELTA[dir].y };
}

function dirBetween(from: Point, to: Point): Direction | null {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (dx === 1 && dy === 0) return "right";
  if (dx === -1 && dy === 0) return "left";
  if (dy === 1 && dx === 0) return "down";
  if (dy === -1 && dx === 0) return "up";
  return null;
}

function inBounds(state: GameState, p: Point) {
  return p.x >= 0 && p.y >= 0 && p.x < state.cols && p.y < state.rows;
}

function isFood(state: GameState, cell: Point) {
  return state.foods.some((food) => food.x === cell.x && food.y === cell.y);
}

function occupiedAfterMove(state: GameState, next: Point) {
  const eating = isFood(state, next);
  const body = eating || state.pendingGrow > 0 ? state.snake : state.snake.slice(0, -1);
  return body.some((part) => part.x === next.x && part.y === next.y);
}

function wouldDie(state: GameState, dir: Direction) {
  const next = cellAt(state.snake[0], dir);
  if (!inBounds(state, next)) return true;
  return occupiedAfterMove(state, next);
}

type Sim = {
  cols: number;
  rows: number;
  snake: Point[];
  pendingGrow: number;
  foods: Point[];
};

function toSim(state: GameState): Sim {
  return {
    cols: state.cols,
    rows: state.rows,
    snake: state.snake.map((p) => ({ ...p })),
    pendingGrow: state.pendingGrow,
    foods: state.foods.map((food) => ({ x: food.x, y: food.y })),
  };
}

function simInBounds(sim: Sim, p: Point) {
  return p.x >= 0 && p.y >= 0 && p.x < sim.cols && p.y < sim.rows;
}

function simBlocked(sim: Sim, growing: boolean) {
  const keys = new Set<string>();
  const last = sim.snake.length - 1;
  for (let i = 0; i < sim.snake.length; i += 1) {
    if (!growing && i === last) continue;
    keys.add(keyOf(sim.snake[i]));
  }
  return keys;
}

function floodFrom(sim: Sim, start: Point, blocked: Set<string>) {
  const seen = new Set<string>();
  const q: Point[] = [];
  const tryPush = (p: Point) => {
    if (!simInBounds(sim, p)) return;
    const id = keyOf(p);
    if (seen.has(id) || blocked.has(id)) return;
    seen.add(id);
    q.push(p);
  };
  if (blocked.has(keyOf(start))) {
    for (const dir of DIRS) tryPush(cellAt(start, dir));
  } else {
    tryPush(start);
  }
  for (let i = 0; i < q.length; i += 1) {
    for (const dir of DIRS) tryPush(cellAt(q[i], dir));
  }
  return seen;
}

function canReachTail(sim: Sim) {
  const head = sim.snake[0];
  const tail = sim.snake[sim.snake.length - 1];
  const growing = sim.pendingGrow > 0;
  const blocked = simBlocked(sim, growing);
  const area = floodFrom(sim, head, blocked);
  if (area.has(keyOf(tail))) return true;
  for (const dir of DIRS) {
    const n = cellAt(tail, dir);
    if (eq(n, head) || area.has(keyOf(n))) return true;
  }
  return false;
}

function stepSim(sim: Sim, next: Point): Sim | null {
  if (!simInBounds(sim, next)) return null;
  const eating = sim.foods.some((food) => food.x === next.x && food.y === next.y);
  const growing = eating || sim.pendingGrow > 0;
  const body = growing ? sim.snake : sim.snake.slice(0, -1);
  if (body.some((part) => part.x === next.x && part.y === next.y)) return null;
  const snake = [next, ...sim.snake];
  let pendingGrow = sim.pendingGrow;
  if (eating) {
    pendingGrow += 0;
  } else if (pendingGrow > 0) {
    pendingGrow -= 1;
  } else {
    snake.pop();
  }
  const foods = eating
    ? sim.foods.filter((food) => food.x !== next.x || food.y !== next.y)
    : sim.foods;
  const nextSim = { ...sim, snake, pendingGrow, foods };
  if (!canReachTail(nextSim)) return null;
  return nextSim;
}

function cycleLen(state: GameState) {
  return state.cols * state.rows;
}

function idxOf(state: GameState, cell: Point) {
  return state.cycleIndex[cell.y]?.[cell.x] ?? -1;
}

function cycleDist(state: GameState, from: Point, to: Point) {
  const n = cycleLen(state);
  const a = idxOf(state, from);
  const b = idxOf(state, to);
  if (a < 0 || b < 0) return n;
  return (b - a + n) % n;
}

function spaceToTail(state: GameState) {
  const n = cycleLen(state);
  const d = cycleDist(state, state.snake[0], state.snake[state.snake.length - 1]);
  return d === 0 ? n : d;
}

function targetApple(state: GameState) {
  const space = spaceToTail(state);
  const head = state.snake[0];
  const ahead = state.foods
    .map((food) => ({ food, dist: cycleDist(state, head, food) }))
    .filter((item) => item.dist > 0 && item.dist < space)
    .sort((a, b) => a.dist - b.dist);
  return ahead[0]?.food ?? null;
}

function tryMove(state: GameState, dir: Direction) {
  if (dir === OPPOSITE[state.direction] || wouldDie(state, dir)) return false;
  return Boolean(stepSim(toSim(state), cellAt(state.snake[0], dir)));
}

function cycleMoveDir(state: GameState): Direction | null {
  const head = state.snake[0];
  const space = spaceToTail(state);
  const apple = targetApple(state);
  const rails = state.cycleNext[head.y]?.[head.x];
  let best: { dir: Direction; dist: number; skip: number } | null = null;

  for (const dir of DIRS) {
    if (!tryMove(state, dir)) continue;
    const cell = cellAt(head, dir);
    const skip = cycleDist(state, head, cell);
    if (skip === 0 || skip >= space) continue;
    const dist = apple ? cycleDist(state, cell, apple) : skip;
    if (
      !best ||
      dist < best.dist ||
      (dist === best.dist && skip < best.skip) ||
      (dist === best.dist && skip === best.skip && rails && eq(cell, rails))
    ) {
      best = { dir, dist, skip };
    }
  }
  return best?.dir ?? null;
}

export function pickAutoplayDir(state: GameState): Direction {
  const facing = state.queued.at(-1) ?? state.direction;
  const cycle = cycleMoveDir(state);
  if (cycle) return cycle;
  for (const dir of DIRS) {
    if (dir === OPPOSITE[state.direction]) continue;
    if (!wouldDie(state, dir)) return dir;
  }
  return facing;
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
