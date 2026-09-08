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
const MIN_CUT_SAVE = 16;

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

function cellAt(from: Point, dir: Direction) {
  return { x: from.x + DELTA[dir].x, y: from.y + DELTA[dir].y };
}

function hamCellOk(
  state: GameState,
  cell: Point,
  headI: number,
  tailI: number,
  n: number,
  growing: boolean,
  appleI: number | null,
) {
  if (!inBounds(state, cell)) return false;
  const cellI = state.cycleIndex[cell.y]?.[cell.x];
  if (cellI == null || cellI < 0) return false;
  if (!aheadOfTail(headI, cellI, tailI, n, growing || isFood(state, cell))) return false;
  if (appleI != null) {
    const toCell = fwd(headI, cellI, n);
    const toApple = fwd(headI, appleI, n);
    if (toCell > toApple) return false;
  }
  return true;
}

function nearestApple(state: GameState, headI: number, n: number) {
  let best: Point | null = null;
  let bestD = Infinity;
  for (const food of state.foods) {
    const i = state.cycleIndex[food.y]?.[food.x];
    if (i == null || i < 0) continue;
    const d = fwd(headI, i, n);
    if (d > 0 && d < bestD) {
      bestD = d;
      best = food;
    }
  }
  return best ? { food: best, cycleDist: bestD, appleI: state.cycleIndex[best.y][best.x] } : null;
}

function huntCutDir(
  state: GameState,
  head: Point,
  headI: number,
  tailI: number,
  n: number,
  growing: boolean,
  blocked: Set<string>,
): Direction | null {
  const target = nearestApple(state, headI, n);
  if (!target) return null;
  const noGo = OPPOSITE[state.direction];
  type Node = { x: number; y: number; first: Direction; g: number };
  const best = new Map<string, number>();
  const open: Node[] = [];

  for (const dir of DIRS) {
    if (dir === noGo) continue;
    const p = cellAt(head, dir);
    if (wouldDie(state, dir) || !isClear(state, p, blocked)) continue;
    if (!hamCellOk(state, p, headI, tailI, n, growing, target.appleI)) continue;
    if (p.x === target.food.x && p.y === target.food.y) {
      return target.cycleDist - 1 >= MIN_CUT_SAVE ? dir : null;
    }
    best.set(keyOf(p), 1);
    open.push({ x: p.x, y: p.y, first: dir, g: 1 });
  }

  let i = 0;
  while (i < open.length) {
    const cur = open[i];
    i += 1;
    if (cur.g >= target.cycleDist - MIN_CUT_SAVE) continue;
    for (const dir of DIRS) {
      const p = { x: cur.x + DELTA[dir].x, y: cur.y + DELTA[dir].y };
      if (!isClear(state, p, blocked)) continue;
      if (!hamCellOk(state, p, headI, tailI, n, growing, target.appleI)) continue;
      const g = cur.g + 1;
      const id = keyOf(p);
      if (p.x === target.food.x && p.y === target.food.y) {
        if (target.cycleDist - g >= MIN_CUT_SAVE) return cur.first;
        continue;
      }
      if (g >= (best.get(id) ?? Infinity)) continue;
      if (g >= target.cycleDist - MIN_CUT_SAVE) continue;
      best.set(id, g);
      open.push({ x: p.x, y: p.y, first: cur.first, g });
    }
  }
  return null;
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

  const growing = state.pendingGrow > 0;
  const blocked = snakeKeys(state, growing);
  const hamOk = (dir: Direction, cell: Point) => {
    if (dir === OPPOSITE[state.direction]) return false;
    if (wouldDie(state, dir) || !isClear(state, cell, blocked)) return false;
    return hamCellOk(state, cell, headI, tailI, n, growing || isFood(state, cell), null);
  };

  for (const dir of DIRS) {
    if (dir === OPPOSITE[state.direction]) continue;
    const cell = cellAt(head, dir);
    if (!isFood(state, cell) || wouldDie(state, dir)) continue;
    if (!hamOk(dir, cell)) continue;
    return dir;
  }

  const cut = huntCutDir(state, head, headI, tailI, n, growing, blocked);
  if (cut && hamOk(cut, cellAt(head, cut))) return cut;

  const cycleSafe =
    cycleDir !== OPPOSITE[state.direction] && !wouldDie(state, cycleDir);
  if (cycleSafe) return cycleDir;

  for (const dir of DIRS) {
    if (dir === cycleDir) continue;
    if (hamOk(dir, cellAt(head, dir))) return dir;
  }
  for (const dir of DIRS) {
    if (dir === OPPOSITE[state.direction]) continue;
    if (!wouldDie(state, dir)) return dir;
  }
  return state.direction;
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
