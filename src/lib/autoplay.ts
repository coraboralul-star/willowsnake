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
const LEFT: Record<Direction, Direction> = {
  up: "left",
  left: "down",
  down: "right",
  right: "up",
};
const RIGHT: Record<Direction, Direction> = {
  up: "right",
  right: "down",
  down: "left",
  left: "up",
};
const CARPET = 6;
const FILL_SWEEP = 0.55;

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

function manhattan(a: Point, b: Point) {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
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

function pathTo(sim: Sim, goal: Point, noGo: Direction | null): Point[] | null {
  const head = sim.snake[0];
  if (eq(head, goal)) return [];
  const blocked = simBlocked(sim, sim.pendingGrow > 0);
  const prev = new Map<string, Point>();
  const q: Point[] = [];

  for (const dir of DIRS) {
    if (dir === noGo) continue;
    const p = cellAt(head, dir);
    if (!simInBounds(sim, p) || blocked.has(keyOf(p))) continue;
    prev.set(keyOf(p), head);
    q.push(p);
    if (eq(p, goal)) return [p];
  }

  let i = 0;
  while (i < q.length) {
    const cur = q[i];
    i += 1;
    for (const dir of DIRS) {
      const p = cellAt(cur, dir);
      const id = keyOf(p);
      if (!simInBounds(sim, p) || blocked.has(id) || prev.has(id)) continue;
      prev.set(id, cur);
      q.push(p);
      if (eq(p, goal)) {
        const path: Point[] = [p];
        let at: Point | undefined = cur;
        while (at && !eq(at, head)) {
          path.push(at);
          at = prev.get(keyOf(at));
        }
        path.reverse();
        return path;
      }
    }
  }
  return null;
}

function pathSafe(state: GameState, path: Point[]) {
  let sim = toSim(state);
  for (const cell of path) {
    const next = stepSim(sim, cell);
    if (!next) return false;
    sim = next;
  }
  return true;
}

function huntDir(state: GameState): Direction | null {
  const noGo = OPPOSITE[state.direction];
  const head = state.snake[0];
  const apples = state.foods
    .slice()
    .sort((a, b) => manhattan(head, a) - manhattan(head, b) || a.x - b.x);
  const sim0 = toSim(state);

  for (const apple of apples) {
    const path = pathTo(sim0, apple, noGo);
    if (!path || path.length === 0) continue;
    if (!pathSafe(state, path)) continue;
    const dir = dirBetween(head, path[0]);
    if (dir && dir !== noGo && !wouldDie(state, dir)) return dir;
  }
  return null;
}

function bodyHugs(state: GameState, cell: Point) {
  const keys = new Set(state.snake.map(keyOf));
  let n = 0;
  for (const dir of DIRS) {
    if (keys.has(keyOf(cellAt(cell, dir)))) n += 1;
  }
  return n;
}

function sweepDir(state: GameState): Direction | null {
  const facing = state.direction;
  const noGo = OPPOSITE[facing];
  const order = [LEFT[facing], facing, RIGHT[facing], noGo];
  const head = state.snake[0];
  const tail = state.snake[state.snake.length - 1];
  let best: { dir: Direction; score: number } | null = null;

  for (let i = 0; i < order.length; i += 1) {
    const dir = order[i];
    if (dir === noGo && i < 3) continue;
    if (wouldDie(state, dir)) continue;
    const cell = cellAt(head, dir);
    if (!stepSim(toSim(state), cell)) continue;
    const hug = bodyHugs(state, cell);
    const toTail = manhattan(cell, tail);
    const score = (4 - i) * 50 + hug * 10 - toTail;
    if (!best || score > best.score) best = { dir, score };
  }
  return best?.dir ?? null;
}

function cycleFallback(state: GameState): Direction | null {
  const head = state.snake[0];
  const nxt = state.cycleNext[head.y]?.[head.x];
  const dir = nxt ? dirBetween(head, nxt) : null;
  if (!dir || dir === OPPOSITE[state.direction] || wouldDie(state, dir)) return null;
  if (!stepSim(toSim(state), cellAt(head, dir))) return null;
  return dir;
}

export function pickAutoplayDir(state: GameState): Direction {
  const facing = state.queued.at(-1) ?? state.direction;
  const fill = state.snake.length / (state.cols * state.rows);
  const carpeted = state.foods.length >= CARPET || fill >= FILL_SWEEP;

  for (const dir of DIRS) {
    if (dir === OPPOSITE[state.direction]) continue;
    const cell = cellAt(state.snake[0], dir);
    if (!isFood(state, cell) || wouldDie(state, dir)) continue;
    if (stepSim(toSim(state), cell)) return dir;
  }

  if (!carpeted) {
    const hunt = huntDir(state);
    if (hunt) return hunt;
  }

  const sweep = sweepDir(state);
  if (sweep) return sweep;

  if (carpeted) {
    const hunt = huntDir(state);
    if (hunt) return hunt;
  }

  const rails = cycleFallback(state);
  if (rails) return rails;

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
