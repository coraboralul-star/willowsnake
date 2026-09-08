"use client";

import {
  BASE_TICK,
  DELTA,
  OPPOSITE,
  type Direction,
  type GameState,
  type Point,
} from "@/lib/engine";

// Graph-search autoplay ported from https://github.com/chynl/snake (MIT).
// Their grid is 6x6; we only attempt the Hamiltonian close-out once few
// cells remain, otherwise the backtracker cannot finish in a tick.

let autoplayOn = false;
let hamiltonIndex: number[][] | null = null;

export function isAutoplay() {
  return autoplayOn;
}

export function enableAutoplay() {
  autoplayOn = true;
}

export function autoplayOnNewRun(_tickMs = BASE_TICK) {
  hamiltonIndex = null;
}

const DIRS: Direction[] = ["up", "down", "left", "right"];
const HAMILTON_SEARCH_LIMIT = 10_000;
const HAMILTON_MAX_OPEN = 40;

type GSnake = {
  cols: number;
  rows: number;
  snake: Point[];
  direc: Direction;
  foods: Point[];
  pendingGrow: number;
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

function isTail(sim: GSnake, p: Point) {
  return eq(p, tailOf(sim));
}

function isSnakeBody(sim: GSnake, p: Point) {
  return sim.snake.some((part) => part.x === p.x && part.y === p.y);
}

function isReachable(sim: GSnake, p: Point) {
  if (!inBounds(sim, p)) return false;
  if (isFood(sim, p) || isTail(sim, p)) return true;
  return !isSnakeBody(sim, p);
}

function toSim(state: GameState): GSnake {
  return {
    cols: state.cols,
    rows: state.rows,
    snake: state.snake.map((p) => ({ x: p.x, y: p.y })),
    direc: state.queued.at(-1) ?? state.direction,
    foods: state.foods.map((food) => ({ x: food.x, y: food.y })),
    pendingGrow: state.pendingGrow,
  };
}

function cloneSim(sim: GSnake): GSnake {
  return {
    cols: sim.cols,
    rows: sim.rows,
    snake: sim.snake.map((p) => ({ x: p.x, y: p.y })),
    direc: sim.direc,
    foods: sim.foods.map((food) => ({ x: food.x, y: food.y })),
    pendingGrow: sim.pendingGrow,
  };
}

function shuffle<T>(items: T[]) {
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = items[i];
    items[i] = items[j];
    items[j] = tmp;
  }
  return items;
}

function neighbors(sim: GSnake, pos: Point, visited: Set<string>) {
  const result: { dir: Direction; pos: Point }[] = [];
  for (const dir of DIRS) {
    const nbr = cellAt(pos, dir);
    if (!isReachable(sim, nbr) || visited.has(keyOf(nbr))) continue;
    result.push({ dir, pos: nbr });
  }
  return shuffle(result);
}

function numReachable(sim: GSnake) {
  let n = 0;
  for (let y = 0; y < sim.rows; y += 1) {
    for (let x = 0; x < sim.cols; x += 1) {
      if (isReachable(sim, { x, y })) n += 1;
    }
  }
  return n;
}

function shortestPath(sim: GSnake, dst: Point): Direction[] {
  const src = headOf(sim);
  if (eq(src, dst)) return [];
  const visited = new Set<string>([keyOf(src)]);
  const queue: { pos: Point; path: Direction[] }[] = [{ pos: src, path: [] }];
  for (let i = 0; i < queue.length; i += 1) {
    const cur = queue[i];
    if (eq(cur.pos, dst)) return cur.path;
    for (const nbr of neighbors(sim, cur.pos, visited)) {
      visited.add(keyOf(nbr.pos));
      queue.push({ pos: nbr.pos, path: [...cur.path, nbr.dir] });
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
  const body = growing ? sim.snake : sim.snake.slice(0, -1);
  if (body.some((part) => part.x === next.x && part.y === next.y)) return false;
  sim.snake = [next, ...sim.snake];
  if (eating) {
    sim.foods = sim.foods.filter((food) => food.x !== next.x || food.y !== next.y);
  } else if (sim.pendingGrow > 0) {
    sim.pendingGrow -= 1;
  } else {
    sim.snake.pop();
  }
  sim.direc = dir;
  return true;
}

function longerPath(sim: GSnake, dst: Point): Direction[] {
  const shortest = shortestPath(sim, dst);
  const longest: Direction[] = [];
  let cur = headOf(sim);

  for (const dir of shortest) {
    const nxt = cellAt(cur, dir);
    const testDirs: Direction[] =
      dir === "up" || dir === "down" ? ["left", "right"] : ["up", "down"];
    let extended = false;
    for (const test of testDirs) {
      const curEx = cellAt(cur, test);
      const nxtEx = cellAt(nxt, test);
      const curOk = isReachable(sim, curEx) && !isFood(sim, curEx);
      const nxtOk = isReachable(sim, nxtEx) || eq(nxtEx, sim.snake[1]);
      if (curOk && nxtOk) {
        longest.push(test, dir, OPPOSITE[test]);
        extended = true;
        break;
      }
    }
    if (!extended) longest.push(dir);
    cur = nxt;
  }
  return longest;
}

function hamiltonPath(sim: GSnake): Direction[] {
  const dst = tailOf(sim);
  const src = headOf(sim);
  const visited = new Set<string>([keyOf(src)]);
  const path: Direction[] = [];
  const targetLen = numReachable(sim);
  let searches = 0;

  const heuristic = (pos: Point) => neighbors(sim, pos, visited).length;

  const backtrack = (cur: Point): boolean => {
    if (path.length === targetLen) return eq(cur, dst);
    if (searches >= HAMILTON_SEARCH_LIMIT) return false;
    searches += 1;
    const opts = neighbors(sim, cur, visited).sort(
      (a, b) => heuristic(a.pos) - heuristic(b.pos),
    );
    for (const nbr of opts) {
      if (eq(nbr.pos, dst) && path.length < targetLen - 1) continue;
      visited.add(keyOf(nbr.pos));
      path.push(nbr.dir);
      if (backtrack(nbr.pos)) return true;
      path.pop();
      visited.delete(keyOf(nbr.pos));
    }
    return false;
  };

  return backtrack(src) ? path : [];
}

function buildHamiltonIndex(sim: GSnake, path: Direction[]) {
  const index = Array.from({ length: sim.rows }, () => Array<number>(sim.cols).fill(0));
  for (let i = 0; i < sim.snake.length; i += 1) {
    const p = sim.snake[i];
    index[p.y][p.x] = i + 1;
  }
  let cur = headOf(sim);
  let val = sim.cols * sim.rows;
  for (const dir of path) {
    const nxt = cellAt(cur, dir);
    index[nxt.y][nxt.x] = val;
    cur = nxt;
    val -= 1;
  }
  hamiltonIndex = index;
}

function hamiltonDir(sim: GSnake, opts: { dir: Direction; pos: Point }[]): Direction | null {
  if (!hamiltonIndex) return null;
  const head = headOf(sim);
  const headIndex = hamiltonIndex[head.y]?.[head.x] ?? 0;
  if (headIndex <= 0) return null;
  const target = headIndex > 1 ? headIndex - 1 : sim.cols * sim.rows;
  for (const nbr of opts) {
    if (hamiltonIndex[nbr.pos.y]?.[nbr.pos.x] === target) return nbr.dir;
  }
  return null;
}

function nearestFood(sim: GSnake): Point | null {
  const head = headOf(sim);
  let best: Point | null = null;
  let bestD = Infinity;
  for (const food of sim.foods) {
    const d = manhattan(head, food);
    if (d < bestD) {
      best = food;
      bestD = d;
    }
  }
  return best;
}

function usable(dir: Direction | null, facing: Direction, opts: { dir: Direction }[]) {
  if (!dir || dir === OPPOSITE[facing]) return null;
  return opts.some((nbr) => nbr.dir === dir) ? dir : null;
}

function keepsTail(sim: GSnake, dir: Direction) {
  const copy = cloneSim(sim);
  if (!moveSim(copy, dir)) return false;
  return shortestPath(copy, tailOf(copy)).length > 0;
}

function graphNext(state: GameState): Direction {
  const sim = toSim(state);
  const facing = sim.direc;
  const opts = neighbors(sim, headOf(sim), new Set());
  if (opts.length === 0) return facing;

  if (hamiltonIndex) {
    const follow = usable(hamiltonDir(sim, opts), facing, opts);
    if (follow) return follow;
    hamiltonIndex = null;
  }

  if (numReachable(sim) <= HAMILTON_MAX_OPEN) {
    const close = hamiltonPath(sim);
    if (close.length > 0) {
      buildHamiltonIndex(sim, close);
      const follow = usable(hamiltonDir(sim, opts), facing, opts);
      if (follow) return follow;
      hamiltonIndex = null;
    }
  }

  const foods = sim.foods
    .slice()
    .sort((a, b) => manhattan(headOf(sim), a) - manhattan(headOf(sim), b));
  for (const food of foods) {
    const pathToFood = shortestPath(sim, food);
    if (pathToFood.length === 0) continue;
    const copy = cloneSim(sim);
    let ok = true;
    for (const dir of pathToFood) {
      if (!moveSim(copy, dir)) {
        ok = false;
        break;
      }
    }
    if (ok && shortestPath(copy, tailOf(copy)).length > 0) {
      const hunt = usable(pathToFood[0], facing, opts);
      if (hunt) return hunt;
    }
  }

  const toTail = longerPath(sim, tailOf(sim));
  if (toTail.length > 0) {
    const wait = usable(toTail[0], facing, opts);
    if (wait && keepsTail(sim, wait)) return wait;
  }

  const food = nearestFood(sim);
  const ranked = (food
    ? opts.slice().sort((a, b) => manhattan(b.pos, food) - manhattan(a.pos, food))
    : opts
  ).filter((nbr) => usable(nbr.dir, facing, opts));
  for (const nbr of ranked) {
    if (keepsTail(sim, nbr.dir)) return nbr.dir;
  }
  for (const nbr of ranked) return nbr.dir;
  return opts[0].dir;
}

export function pickAutoplayDir(state: GameState): Direction {
  return graphNext(state);
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
