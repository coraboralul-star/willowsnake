"use client";

import {
  BASE_TICK,
  DELTA,
  OPPOSITE,
  type Direction,
  type GameState,
  type Point,
} from "@/lib/engine";

// Livecade ticks (files 7?9): ~75?83% straight, median run 2?4, p90 ~9?14.
// Dominant turn is a perpendicular fold while the row is still open (span ~7?18).
// Wall-to-wall is rare. Tail is a safety check, never a destination.

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

function isBlocked(sim: GSnake, p: Point, growing: boolean) {
  if (!inBounds(sim, p)) return true;
  if (isFood(sim, p)) return false;
  if (!growing && eq(p, tailOf(sim))) return false;
  return sim.body.has(keyOf(p));
}

function isOpen(sim: GSnake, p: Point) {
  return !isBlocked(sim, p, sim.pendingGrow > 0);
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
      if (!inBounds(sim, nbr)) continue;
      const id = keyOf(nbr);
      if (visited.has(id)) continue;
      if (eq(nbr, dst)) return [...cur.path, dir];
      if (!isOpen(sim, nbr)) continue;
      visited.add(id);
      queue.push({ pos: nbr, path: [...cur.path, dir] });
    }
  }
  return [];
}

function moveSim(sim: GSnake, dir: Direction): boolean {
  if (dir === OPPOSITE[sim.direc]) return false;
  const next = cellAt(headOf(sim), dir);
  if (isBlocked(sim, next, isFood(sim, next) || sim.pendingGrow > 0)) return false;
  const eating = isFood(sim, next);
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
  return moveSim(cloneSim(sim), dir);
}

function legalDirs(sim: GSnake) {
  return DIRS.filter((dir) => dir !== OPPOSITE[sim.direc] && canStep(sim, dir));
}

function keepsTail(sim: GSnake, dir: Direction) {
  const copy = cloneSim(sim);
  if (!moveSim(copy, dir)) return false;
  return shortestPath(copy, tailOf(copy)).length > 0;
}

function roomAfter(sim: GSnake, dir: Direction) {
  const copy = cloneSim(sim);
  if (!moveSim(copy, dir)) return 0;
  return floodSize(copy, headOf(copy));
}

function safeDirs(sim: GSnake) {
  return legalDirs(sim).filter((dir) => keepsTail(sim, dir));
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

function currentRun(sim: GSnake) {
  const d = sim.direc;
  let n = 0;
  for (let i = 0; i < sim.snake.length - 1; i += 1) {
    if (dirBetween(sim.snake[i + 1], sim.snake[i]) !== d) break;
    n += 1;
  }
  return n;
}

function neckOf(sim: GSnake) {
  return sim.snake[1];
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

function onBodyFace(sim: GSnake) {
  return bodyTouches(sim, headOf(sim), neckOf(sim)) > 0;
}

function floodCells(sim: GSnake, start: Point, limit = sim.cols * sim.rows) {
  const cells: Point[] = [];
  if (!isOpen(sim, start) && !eq(start, headOf(sim))) return cells;
  const seen = new Set<string>();
  const q: Point[] = [];
  const push = (p: Point) => {
    if (!isOpen(sim, p) && !eq(p, start)) return;
    const id = keyOf(p);
    if (seen.has(id)) return;
    if (!isOpen(sim, p) && eq(p, start)) {
      for (const dir of DIRS) push(cellAt(p, dir));
      return;
    }
    seen.add(id);
    q.push(p);
    cells.push(p);
  };
  push(start);
  for (let i = 0; i < q.length && seen.size < limit; i += 1) {
    for (const dir of DIRS) push(cellAt(q[i], dir));
  }
  return cells;
}

function floodSize(sim: GSnake, start: Point, limit = sim.cols * sim.rows) {
  return floodCells(sim, start, limit).length;
}

function fillRatio(sim: GSnake) {
  return sim.snake.length / (sim.cols * sim.rows);
}

function isHoriz(dir: Direction) {
  return dir === "left" || dir === "right";
}

function spanIn(sim: GSnake, dir: Direction) {
  const limit = isHoriz(dir) ? sim.cols : sim.rows;
  let n = 0;
  let p = headOf(sim);
  for (let i = 0; i < limit; i += 1) {
    p = cellAt(p, dir);
    if (!isOpen(sim, p)) break;
    n += 1;
  }
  return n;
}

function huntSafe(sim: GSnake, path: Direction[]) {
  if (path.length === 0) return false;
  const copy = cloneSim(sim);
  for (const dir of path) {
    if (!moveSim(copy, dir)) return false;
  }
  return shortestPath(copy, tailOf(copy)).length > 0;
}

function anySafeHunt(sim: GSnake): Direction | null {
  const facing = sim.direc;
  const foods = sim.foods
    .slice()
    .sort((a, b) => manhattan(headOf(sim), a) - manhattan(headOf(sim), b));
  for (const food of foods) {
    const path = shortestPath(sim, food);
    if (path.length === 0 || !huntSafe(sim, path)) continue;
    const dir = path[0];
    if (!dir || dir === OPPOSITE[facing] || !keepsTail(sim, dir)) continue;
    return dir;
  }
  return null;
}

function packDir(sim: GSnake): Direction | null {
  const opts = safeDirs(sim);
  if (opts.length === 0) return null;
  const head = headOf(sim);
  const facing = sim.direc;
  const fill = fillRatio(sim);
  const run = currentRun(sim);
  const hunt = anySafeHunt(sim);

  let best: { dir: Direction; score: number } | null = null;
  for (const dir of opts) {
    const next = cellAt(head, dir);
    const hug = bodyTouches(sim, next, head);
    const room = roomAfter(sim, dir);
    const span = spanIn(sim, dir);
    const facingDir = dir === facing;
    let score = hug * 22 + room * 0.4;
    if (facingDir) score += 14;
    if (hug >= 1) score += 18;
    // Ticks: they fold while ~7?18 cells are still open. Do not commute to the far wall.
    if (facingDir && hug === 0 && (span >= 4 || run >= 4)) score -= 60;
    if (!facingDir && hug >= 1) score += 20;
    if (isFood(sim, next)) score += 90;
    if (dir === hunt) score += fill < 0.35 ? 16 : 4;
    if (isHoriz(dir) && fill > 0.3) score += 5;
    if (facingDir && run >= 8) {
      const foldHugs = opts.some((other) => {
        if (other === facing || other === OPPOSITE[facing]) return false;
        return bodyTouches(sim, cellAt(head, other), head) >= 1;
      });
      if (foldHugs) score -= 32;
    }
    if (!best || score > best.score) best = { dir, score };
  }
  return best?.dir ?? null;
}

function pickDir(state: GameState): Direction {
  const sim = toSim(state);
  const opts = legalDirs(sim);
  if (opts.length === 0) return sim.direc;

  for (const dir of safeDirs(sim)) {
    if (isFood(sim, cellAt(headOf(sim), dir))) return dir;
  }

  const fill = fillRatio(sim);
  if (fill < 0.12 || (!onBodyFace(sim) && fill < 0.45)) {
    const hunt = anySafeHunt(sim);
    if (hunt) return hunt;
  }

  const pack = packDir(sim);
  if (pack) return pack;

  if (fill < 0.35) {
    const hunt = anySafeHunt(sim);
    if (hunt) return hunt;
  }

  const safe = safeDirs(sim);
  if (safe.length > 0) {
    let best = safe[0];
    let bestRoom = -1;
    for (const dir of safe) {
      const room = roomAfter(sim, dir);
      if (room > bestRoom) {
        best = dir;
        bestRoom = room;
      }
    }
    return best;
  }
  return opts[0];
}

export function pickAutoplayDir(state: GameState): Direction {
  return pickDir(state);
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
