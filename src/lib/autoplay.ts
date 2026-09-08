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
let recentHeads: string[] = [];

export function isAutoplay() {
  return autoplayOn;
}

export function enableAutoplay() {
  autoplayOn = true;
}

export function autoplayOnNewRun(_tickMs = BASE_TICK) {
  recentHeads = [];
}

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

function firstSafeDir(state: GameState, path: Point[] | null): Direction | null {
  if (!path || path.length === 0) return null;
  if (!pathSafe(state, path)) return null;
  const dir = dirBetween(state.snake[0], path[0]);
  if (!dir || dir === OPPOSITE[state.direction] || wouldDie(state, dir)) return null;
  return dir;
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
    const dir = firstSafeDir(state, path);
    if (dir) return dir;
  }
  return null;
}

function snakeSet(state: GameState) {
  return new Set(state.snake.map(keyOf));
}

function coverCount(state: GameState, keys: Set<string>, cell: Point) {
  let n = 0;
  for (const dir of DIRS) {
    const p = cellAt(cell, dir);
    if (!inBounds(state, p) || keys.has(keyOf(p))) n += 1;
  }
  return n;
}

function emptySpan(
  state: GameState,
  keys: Set<string>,
  cell: Point,
  horizontal: boolean,
) {
  let lo = horizontal ? cell.x : cell.y;
  let hi = lo;
  const max = horizontal ? state.cols - 1 : state.rows - 1;
  const emptyAt = (v: number) => {
    const p = horizontal ? { x: v, y: cell.y } : { x: cell.x, y: v };
    return inBounds(state, p) && !keys.has(keyOf(p));
  };
  const blockedByBody = (v: number) => {
    if (v < 0 || v > max) return false;
    const p = horizontal ? { x: v, y: cell.y } : { x: cell.x, y: v };
    return keys.has(keyOf(p));
  };
  while (lo > 0 && emptyAt(lo - 1)) lo -= 1;
  while (hi < max && emptyAt(hi + 1)) hi += 1;
  const bodyEnds = (blockedByBody(lo - 1) ? 1 : 0) + (blockedByBody(hi + 1) ? 1 : 0);
  return { lo, hi, len: hi - lo + 1, bodyEnds };
}

function spanIsHole(
  h: { len: number; bodyEnds: number },
  v: { len: number; bodyEnds: number },
) {
  if (h.bodyEnds === 2 && h.len <= 8) return true;
  if (v.bodyEnds === 2 && v.len >= 3 && v.len <= 12) return true;
  return false;
}

function isTightCell(state: GameState, keys: Set<string>, cell: Point) {
  if (!inBounds(state, cell) || keys.has(keyOf(cell))) return false;
  return spanIsHole(emptySpan(state, keys, cell, true), emptySpan(state, keys, cell, false));
}

function tightFlood(state: GameState, keys: Set<string>, start: Point) {
  if (!isTightCell(state, keys, start)) return 0;
  const seen = new Set<string>([keyOf(start)]);
  const q: Point[] = [start];
  for (let i = 0; i < q.length; i += 1) {
    for (const dir of DIRS) {
      const n = cellAt(q[i], dir);
      const id = keyOf(n);
      if (seen.has(id) || !isTightCell(state, keys, n)) continue;
      seen.add(id);
      q.push(n);
    }
  }
  return seen.size;
}

function noteHead(state: GameState) {
  recentHeads.push(keyOf(state.snake[0]));
  if (recentHeads.length > 40) recentHeads.shift();
}

function looping() {
  if (recentHeads.length < 16) return false;
  const slice = recentHeads.slice(-20);
  const unique = new Set(slice);
  if (slice.length >= 16 && unique.size <= 8) return true;
  const cur = recentHeads[recentHeads.length - 1];
  return slice.slice(0, -1).filter((k) => k === cur).length >= 2;
}

function recentlyAt(cell: Point, within = 12) {
  const id = keyOf(cell);
  return recentHeads.slice(-within).includes(id);
}

function currentRun(state: GameState) {
  const d = state.direction;
  let n = 1;
  for (let i = 0; i < state.snake.length - 1; i += 1) {
    if (dirBetween(state.snake[i + 1], state.snake[i]) !== d) break;
    n += 1;
  }
  return n;
}

function isHoriz(dir: Direction) {
  return dir === "left" || dir === "right";
}

function holeNearby(state: GameState, keys: Set<string>) {
  const head = state.snake[0];
  const h = emptySpan(state, keys, head, true);
  const v = emptySpan(state, keys, head, false);
  if (spanIsHole(h, v)) return true;
  for (const dir of DIRS) {
    if (tightFlood(state, keys, cellAt(head, dir)) > 0) return true;
  }
  return false;
}

function tryStep(state: GameState, dir: Direction) {
  if (dir === OPPOSITE[state.direction] || wouldDie(state, dir)) return false;
  return Boolean(stepSim(toSim(state), cellAt(state.snake[0], dir)));
}

function gapFillDir(state: GameState): Direction | null {
  const head = state.snake[0];
  const keys = snakeSet(state);
  const hRun = emptySpan(state, keys, head, true);
  const vRun = emptySpan(state, keys, head, false);
  if (!spanIsHole(hRun, vRun)) return null;
  const useH = !(hRun.len <= 2 && vRun.len >= 3);
  const run = currentRun(state);

  let best: { dir: Direction; score: number } | null = null;
  for (const dir of DIRS) {
    if (!tryStep(state, dir)) continue;
    const cell = cellAt(head, dir);
    const h = emptySpan(state, keys, cell, true);
    const v = emptySpan(state, keys, cell, false);
    const hole = tightFlood(state, keys, cell);
    const horizMove = isHoriz(dir);
    let along = 0;
    let fold = 0;
    if (useH) {
      if (dir === "right" && head.x < hRun.hi) along = 1;
      if (dir === "left" && head.x > hRun.lo) along = 1;
      if ((head.x === hRun.lo || head.x === hRun.hi) && (dir === "up" || dir === "down")) fold = 1;
    } else {
      if (dir === "down" && head.y < vRun.hi) along = 1;
      if (dir === "up" && head.y > vRun.lo) along = 1;
      if ((head.y === vRun.lo || head.y === vRun.hi) && isHoriz(dir)) fold = 1;
    }
    const shortVert =
      !horizMove &&
      ((dir === state.direction && run < 3 && vRun.len < 3) ||
        (dir !== state.direction && isHoriz(state.direction) && fold === 0 && v.len < 3));
    const score =
      (hole > 0 ? 70 - hole : 0) +
      (horizMove ? 18 : 0) +
      along * 28 +
      fold * 40 -
      (shortVert ? 55 : 0) -
      (recentlyAt(cell, 10) ? 90 : 0);
    if (!best || score > best.score) best = { dir, score };
  }
  return best?.dir ?? null;
}

function openDir(state: GameState): Direction | null {
  const head = state.snake[0];
  const keys = snakeSet(state);
  const apple = state.foods
    .slice()
    .sort((a, b) => manhattan(head, a) - manhattan(head, b))[0];
  let best: { dir: Direction; score: number } | null = null;
  for (const dir of DIRS) {
    if (!tryStep(state, dir)) continue;
    const cell = cellAt(head, dir);
    const h = emptySpan(state, keys, cell, true);
    const v = emptySpan(state, keys, cell, false);
    const covers = coverCount(state, keys, cell);
    const room = Math.min(h.len, v.len);
    const toward = apple ? manhattan(head, apple) - manhattan(cell, apple) : 0;
    const score =
      toward * 30 +
      room * 3 +
      (covers === 0 ? 40 : 0) -
      covers * 18 +
      (isHoriz(dir) ? 8 : 0) +
      (dir === state.direction ? 10 : 0) -
      (recentlyAt(cell, 10) ? 80 : 0);
    if (!best || score > best.score) best = { dir, score };
  }
  return best?.dir ?? null;
}

function tailOutDir(state: GameState): Direction | null {
  const facing = state.direction;
  const noGo = OPPOSITE[facing];
  const order = [LEFT[facing], facing, RIGHT[facing], noGo];
  const tail = state.snake[state.snake.length - 1];
  const head = state.snake[0];
  let best: { dir: Direction; score: number } | null = null;

  for (let i = 0; i < order.length; i += 1) {
    const dir = order[i];
    if (dir === noGo && i < 3) continue;
    if (wouldDie(state, dir)) continue;
    const cell = cellAt(head, dir);
    if (!stepSim(toSim(state), cell)) continue;
    const score = (4 - i) * 20 - manhattan(cell, tail);
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
  noteHead(state);

  for (const dir of DIRS) {
    if (dir === OPPOSITE[state.direction]) continue;
    const cell = cellAt(state.snake[0], dir);
    if (!isFood(state, cell) || wouldDie(state, dir)) continue;
    if (stepSim(toSim(state), cell)) return dir;
  }

  const hunt = huntDir(state);
  if (hunt) return hunt;

  const keys = snakeSet(state);
  if (!looping() && holeNearby(state, keys)) {
    const holeFill = gapFillDir(state);
    if (holeFill) return holeFill;
  }

  const open = openDir(state);
  if (open) return open;

  const out = tailOutDir(state);
  if (out) return out;

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
