"use client";

import {
  BASE_TICK,
  DELTA,
  OPPOSITE,
  type Direction,
  type GameState,
  type Point,
} from "@/lib/engine";

// Courtyard autoplay: cut to fruit only when the whole route stays
// survivable, otherwise ride the body contour (right hand on the snake).
// That leaves one packed loop and one open room. No board-wide rail,
// no zigzag-to-tail painter.

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

type GSnake = {
  cols: number;
  rows: number;
  snake: Point[];
  direc: Direction;
  foods: Point[];
  pendingGrow: number;
  body: Set<string>;
};

function keyOf(p: Point) {
  return `${p.x},${p.y}`;
}

function eq(a: Point, b: Point) {
  return a.x === b.x && a.y === b.y;
}

function cellAt(from: Point, dir: Direction): Point {
  return { x: from.x + DELTA[dir].x, y: from.y + DELTA[dir].y };
}

function manhattan(a: Point, b: Point) {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

function inBounds(sim: GSnake, p: Point) {
  return p.x >= 0 && p.y >= 0 && p.x < sim.cols && p.y < sim.rows;
}

function headOf(sim: GSnake) {
  return sim.snake[0];
}

function neckOf(sim: GSnake) {
  return sim.snake[1];
}

function tailOf(sim: GSnake) {
  return sim.snake[sim.snake.length - 1];
}

function isFood(sim: GSnake, p: Point) {
  return sim.foods.some((food) => food.x === p.x && food.y === p.y);
}

function rebuildBody(sim: GSnake) {
  sim.body = new Set(sim.snake.map(keyOf));
}

function toSim(state: GameState): GSnake {
  const sim: GSnake = {
    cols: state.cols,
    rows: state.rows,
    snake: state.snake.map((p) => ({ x: p.x, y: p.y })),
    direc: state.queued.at(-1) ?? state.direction,
    foods: state.foods.map((food) => ({ x: food.x, y: food.y })),
    pendingGrow: state.pendingGrow,
    body: new Set(),
  };
  rebuildBody(sim);
  return sim;
}

function cloneSim(sim: GSnake): GSnake {
  const copy: GSnake = {
    cols: sim.cols,
    rows: sim.rows,
    snake: sim.snake.map((p) => ({ x: p.x, y: p.y })),
    direc: sim.direc,
    foods: sim.foods.map((food) => ({ x: food.x, y: food.y })),
    pendingGrow: sim.pendingGrow,
    body: new Set(),
  };
  rebuildBody(copy);
  return copy;
}

function isReachable(sim: GSnake, p: Point) {
  if (!inBounds(sim, p)) return false;
  if (isFood(sim, p) || eq(p, tailOf(sim))) return true;
  return !sim.body.has(keyOf(p));
}

function expandOrder(last: Direction | null): Direction[] {
  if (!last) return DIRS;
  return [last, LEFT[last], RIGHT[last], OPPOSITE[last]];
}

function shortestPath(sim: GSnake, dst: Point): Direction[] {
  const src = headOf(sim);
  if (eq(src, dst)) return [];
  const visited = new Set<string>([keyOf(src)]);
  const queue: { pos: Point; path: Direction[] }[] = [{ pos: src, path: [] }];
  for (let i = 0; i < queue.length; i += 1) {
    const cur = queue[i];
    if (eq(cur.pos, dst)) return cur.path;
    const last = cur.path.at(-1) ?? sim.direc;
    for (const dir of expandOrder(last)) {
      const nbr = cellAt(cur.pos, dir);
      const id = keyOf(nbr);
      if (!isReachable(sim, nbr) || visited.has(id)) continue;
      visited.add(id);
      queue.push({ pos: nbr, path: [...cur.path, dir] });
    }
  }
  return [];
}

function moveSim(sim: GSnake, dir: Direction): boolean {
  if (dir === OPPOSITE[sim.direc]) return false;
  const next = cellAt(headOf(sim), dir);
  if (!inBounds(sim, next)) return false;
  const eating = isFood(sim, next);
  const growing = eating || sim.pendingGrow > 0;
  const blocked = growing ? sim.body : new Set([...sim.body].filter((id) => id !== keyOf(tailOf(sim))));
  if (blocked.has(keyOf(next))) return false;
  sim.snake = [next, ...sim.snake];
  if (eating) {
    sim.foods = sim.foods.filter((food) => food.x !== next.x || food.y !== next.y);
  } else if (sim.pendingGrow > 0) {
    sim.pendingGrow -= 1;
  } else {
    sim.snake.pop();
  }
  sim.direc = dir;
  rebuildBody(sim);
  return true;
}

function canStep(sim: GSnake, dir: Direction) {
  const copy = cloneSim(sim);
  return moveSim(copy, dir);
}

function keepsTail(sim: GSnake, dir: Direction) {
  const copy = cloneSim(sim);
  if (!moveSim(copy, dir)) return false;
  return shortestPath(copy, tailOf(copy)).length > 0;
}

function legalDirs(sim: GSnake) {
  const facing = sim.direc;
  return DIRS.filter((dir) => dir !== OPPOSITE[facing] && canStep(sim, dir));
}

function bodyTouches(sim: GSnake, p: Point, skip?: Point) {
  let n = 0;
  for (const dir of DIRS) {
    const nbr = cellAt(p, dir);
    if (skip && eq(nbr, skip)) continue;
    if (inBounds(sim, nbr) && sim.body.has(keyOf(nbr))) n += 1;
  }
  return n;
}

function onContour(sim: GSnake) {
  const head = headOf(sim);
  const neck = neckOf(sim);
  if (!neck) return false;
  return bodyTouches(sim, head, neck) > 0;
}

function isClearCut(sim: GSnake, path: Direction[], food: Point) {
  const head = headOf(sim);
  if (path.length === 0) return false;
  if (path.length > manhattan(head, food) + 2) return false;
  let cur = head;
  for (let i = 0; i < path.length - 1; i += 1) {
    cur = cellAt(cur, path[i]);
    if (bodyTouches(sim, cur, head) >= 2) return false;
  }
  return true;
}

function huntSafe(sim: GSnake, path: Direction[]) {
  if (path.length === 0) return false;
  const copy = cloneSim(sim);
  for (const dir of path) {
    if (!moveSim(copy, dir)) return false;
  }
  return shortestPath(copy, tailOf(copy)).length > 0;
}

function huntDir(sim: GSnake): Direction | null {
  const facing = sim.direc;
  const packing = onContour(sim);
  const foods = sim.foods
    .slice()
    .sort((a, b) => manhattan(headOf(sim), a) - manhattan(headOf(sim), b));

  for (const dir of legalDirs(sim)) {
    const cell = cellAt(headOf(sim), dir);
    if (isFood(sim, cell) && keepsTail(sim, dir)) return dir;
  }

  for (const food of foods) {
    const path = shortestPath(sim, food);
    if (!huntSafe(sim, path)) continue;
    if (packing && !isClearCut(sim, path, food)) continue;
    const dir = path[0];
    if (!dir || dir === OPPOSITE[facing] || !canStep(sim, dir)) continue;
    return dir;
  }
  return null;
}

function rideBody(sim: GSnake): Direction | null {
  const facing = sim.direc;
  const order = [RIGHT[facing], facing, LEFT[facing], OPPOSITE[facing]];
  const keep: Direction[] = [];
  const any: Direction[] = [];
  for (const dir of order) {
    if (dir === OPPOSITE[facing]) continue;
    if (!canStep(sim, dir)) continue;
    any.push(dir);
    if (keepsTail(sim, dir)) keep.push(dir);
  }
  const pool = keep.length > 0 ? keep : any;
  if (pool.length === 0) return null;
  return pool[0];
}

function towardBody(sim: GSnake): Direction | null {
  const head = headOf(sim);
  const facing = sim.direc;
  let best: { dir: Direction; dist: number } | null = null;
  for (const dir of legalDirs(sim)) {
    const cell = cellAt(head, dir);
    let dist = Infinity;
    for (const part of sim.snake.slice(2)) {
      dist = Math.min(dist, manhattan(cell, part));
    }
    if (!best || dist < best.dist) best = { dir, dist };
  }
  if (best && best.dist < Infinity && keepsTail(sim, best.dir)) return best.dir;
  return best?.dir ?? null;
}

function courtyardNext(state: GameState): Direction {
  const sim = toSim(state);
  const facing = sim.direc;
  const opts = legalDirs(sim);
  if (opts.length === 0) return facing;

  const hunt = huntDir(sim);
  if (hunt) return hunt;

  const along = rideBody(sim);
  if (along) return along;

  if (!onContour(sim)) {
    const seek = towardBody(sim);
    if (seek) return seek;
  }

  for (const dir of opts) {
    if (keepsTail(sim, dir)) return dir;
  }
  return opts[0];
}

export function pickAutoplayDir(state: GameState): Direction {
  return courtyardNext(state);
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
