"use client";

import {
  DELTA,
  OPPOSITE,
  type Direction,
  type GameState,
  type Point,
} from "@/lib/engine";

let autoplayOn = false;
let trail: string[] = [];

export function isAutoplay() {
  return autoplayOn;
}

export function enableAutoplay() {
  autoplayOn = true;
}

export function autoplayOnNewRun(_tickMs = 104) {
  trail = [];
}

const DIRS: Direction[] = ["up", "down", "left", "right"];
const MAX_DETOUR = 1;

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

const TURN_LEFT: Record<Direction, Direction> = {
  up: "left",
  left: "down",
  down: "right",
  right: "up",
};

function cellAt(from: Point, dir: Direction) {
  return { x: from.x + DELTA[dir].x, y: from.y + DELTA[dir].y };
}

function closesSoon(state: GameState, from: Point, dir: Direction, blocked: Set<string>) {
  let p = from;
  for (let i = 0; i < 8; i += 1) {
    p = cellAt(p, dir);
    if (!inBounds(state, p)) return true;
    if (isFood(state, p)) return false;
    if (!isClear(state, p, blocked)) return true;
    const sideA = cellAt(p, TURN_LEFT[dir]);
    const sideB = cellAt(p, TURN_LEFT[TURN_LEFT[TURN_LEFT[dir]]]);
    if (isClear(state, sideA, blocked) || isClear(state, sideB, blocked)) return false;
  }
  return false;
}

function cleanWalkLimit(_fill: number) {
  return 3;
}

function cleanAppleDir(
  state: GameState,
  from: Point,
  blocked: Set<string>,
  firstOk: (dir: Direction, cell: Point) => boolean,
  fill: number,
): Direction | null {
  const noGo = OPPOSITE[state.direction];
  const limit = cleanWalkLimit(fill);
  type Node = { x: number; y: number; first: Direction; g: number };
  const best = new Map<string, number>();
  const open: Node[] = [];
  const hits: { dir: Direction; dist: number; detour: number; closes: boolean; closer: boolean; man: number }[] = [];

  for (const dir of DIRS) {
    if (dir === noGo) continue;
    const p = cellAt(from, dir);
    if (!firstOk(dir, p)) continue;
    if (isFood(state, p)) {
      hits.push({
        dir,
        dist: 1,
        detour: 0,
        closes: closesSoon(state, from, dir, blocked),
        closer: true,
        man: 1,
      });
      continue;
    }
    best.set(keyOf(p), 1);
    open.push({ x: p.x, y: p.y, first: dir, g: 1 });
  }

  let i = 0;
  while (i < open.length) {
    const cur = open[i];
    i += 1;
    if (cur.g >= limit) continue;
    for (const dir of DIRS) {
      const p = { x: cur.x + DELTA[dir].x, y: cur.y + DELTA[dir].y };
      if (!isClear(state, p, blocked)) continue;
      const g = cur.g + 1;
      const id = keyOf(p);
      if (isFood(state, p)) {
        const man = manhattan(from, p);
        const step = cellAt(from, cur.first);
        hits.push({
          dir: cur.first,
          dist: g,
          detour: g - man,
          closes: closesSoon(state, from, cur.first, blocked),
          closer: manhattan(step, p) < man,
          man,
        });
        continue;
      }
      if (g >= (best.get(id) ?? Infinity) || g > limit) continue;
      best.set(id, g);
      open.push({ x: p.x, y: p.y, first: cur.first, g });
    }
  }

  const nearby = 3;
  const clean = hits.filter(
    (h) => !h.closes && h.closer && h.detour <= MAX_DETOUR && h.dist <= limit && h.man <= nearby,
  );
  if (clean.length === 0) return null;
  clean.sort((a, b) => a.dist - b.dist || a.detour - b.detour);
  return clean[0].dir;
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
  const here = keyOf(head);
  if (trail[trail.length - 1] !== here) trail.push(here);
  if (trail.length > 16) trail.shift();
  const hamOk = (dir: Direction, cell: Point) => {
    if (dir === OPPOSITE[state.direction]) return false;
    if (wouldDie(state, dir) || !isClear(state, cell, blocked)) return false;
    const cellI = state.cycleIndex[cell.y]?.[cell.x];
    if (cellI == null || cellI < 0) return false;
    return aheadOfTail(headI, cellI, tailI, n, growing || isFood(state, cell));
  };
  const fresh = (cell: Point) => isFood(state, cell) || !trail.includes(keyOf(cell));

  let eat: Direction | null = null;
  for (const dir of DIRS) {
    if (dir === OPPOSITE[state.direction]) continue;
    const cell = cellAt(head, dir);
    if (!isFood(state, cell) || wouldDie(state, dir)) continue;
    if (!hamOk(dir, cell)) continue;
    eat = dir;
    break;
  }
  if (eat) return eat;

  const cycleSafe =
    cycleDir !== OPPOSITE[state.direction] && !wouldDie(state, cycleDir);
  if (cycleSafe) return cycleDir;

  const seek = cleanAppleDir(state, head, blocked, (dir, cell) => hamOk(dir, cell) && fresh(cell), fill);
  if (seek) return seek;
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
