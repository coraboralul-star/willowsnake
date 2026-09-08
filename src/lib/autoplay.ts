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
const EARLY_FILL = 0.4;

function floodReach(state: GameState, start: Point, blocked: Set<string>, cap: number) {
  const seen = new Set<string>([keyOf(start)]);
  const q = [start];
  let count = 0;
  while (q.length && count < cap) {
    const cur = q.pop()!;
    for (const dir of DIRS) {
      const nxt = { x: cur.x + DELTA[dir].x, y: cur.y + DELTA[dir].y };
      const id = keyOf(nxt);
      if (seen.has(id) || !isClear(state, nxt, blocked)) continue;
      seen.add(id);
      q.push(nxt);
      count += 1;
    }
  }
  return count;
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
  if (wouldBoxApple(state, start, flood.seen, blocked)) return null;
  return { apples: apples.length, size: flood.cells.length, seen: flood.seen };
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

function wouldBoxApple(
  state: GameState,
  start: Point,
  seen: Set<string>,
  blocked: Set<string>,
) {
  const extra = new Set(blocked);
  extra.add(keyOf(start));
  for (const food of applesIn(state, seen)) {
    if (food.x === start.x && food.y === start.y) continue;
    let free = 0;
    for (const dir of DIRS) {
      const n = { x: food.x + DELTA[dir].x, y: food.y + DELTA[dir].y };
      if (isClear(state, n, extra)) free += 1;
    }
    if (free === 0) return true;
  }
  return false;
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

function hugsEdge(state: GameState, from: Point, dir: Direction, blocked: Set<string>) {
  const sideA = cellAt(from, TURN_LEFT[dir]);
  const sideB = cellAt(from, TURN_LEFT[TURN_LEFT[TURN_LEFT[dir]]]);
  const closed = (p: Point) => !inBounds(state, p) || blocked.has(keyOf(p));
  return closed(sideA) || closed(sideB);
}

function roomAfter(state: GameState, cell: Point, blocked: Set<string>) {
  const extra = new Set(blocked);
  extra.add(keyOf(cell));
  const empty = state.cols * state.rows - state.snake.length;
  const cap = Math.max(28, Math.min(64, Math.floor(empty * 0.16)));
  return floodReach(state, cell, extra, cap) >= cap;
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

function walkToApple(
  state: GameState,
  from: Point,
  blocked: Set<string>,
  goal: Point | null,
  firstOk: (dir: Direction, cell: Point) => boolean,
): Direction | null {
  const noGo = OPPOSITE[state.direction];
  type Node = { x: number; y: number; first: Direction; g: number };
  const best = new Map<string, number>();
  const open: Node[] = [];
  const hits: { dir: Direction; dist: number; closes: boolean; pin: boolean }[] = [];
  const want = goal ? keyOf(goal) : null;

  for (const dir of DIRS) {
    if (dir === noGo) continue;
    const p = cellAt(from, dir);
    if (!firstOk(dir, p)) continue;
    if (isFood(state, p) && (!want || keyOf(p) === want)) {
      hits.push({ dir, dist: 1, closes: closesSoon(state, from, dir, blocked), pin: hugsEdge(state, from, dir, blocked) });
      continue;
    }
    const id = keyOf(p);
    best.set(id, 1);
    open.push({ x: p.x, y: p.y, first: dir, g: 1 });
  }

  let i = 0;
  while (i < open.length) {
    const cur = open[i];
    i += 1;
    for (const dir of DIRS) {
      const p = { x: cur.x + DELTA[dir].x, y: cur.y + DELTA[dir].y };
      if (!isClear(state, p, blocked)) continue;
      const id = keyOf(p);
      const g = cur.g + 1;
      if (isFood(state, p) && (!want || id === want)) {
        hits.push({
          dir: cur.first,
          dist: g,
          closes: closesSoon(state, from, cur.first, blocked),
          pin: hugsEdge(state, from, cur.first, blocked),
        });
        continue;
      }
      if (g >= (best.get(id) ?? Infinity)) continue;
      best.set(id, g);
      open.push({ x: p.x, y: p.y, first: cur.first, g });
    }
  }

  if (hits.length === 0) return null;
  hits.sort((a, b) => {
    if (a.closes !== b.closes) return a.closes ? 1 : -1;
    if (a.pin !== b.pin) return a.pin ? 1 : -1;
    return a.dist - b.dist;
  });
  const pick = hits.find((h) => !h.closes) ?? hits[0];
  if (pick.closes && pick.dist > 6) return null;
  return pick.dir;
}

function fillSpaceDir(
  state: GameState,
  from: Point,
  blocked: Set<string>,
  firstOk: (dir: Direction, cell: Point) => boolean,
) {
  let best: Direction | null = null;
  let bestN = -1;
  for (const dir of DIRS) {
    const cell = cellAt(from, dir);
    if (!firstOk(dir, cell)) continue;
    const extra = new Set(blocked);
    extra.add(keyOf(cell));
    const n = floodReach(state, cell, extra, 80);
    if (n > bestN) {
      bestN = n;
      best = dir;
    }
  }
  return best;
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
  const hamOk = (dir: Direction, cell: Point) => {
    if (dir === OPPOSITE[state.direction]) return false;
    if (wouldDie(state, dir) || !isClear(state, cell, blocked)) return false;
    if (fill < EARLY_FILL) return true;
    const cellI = state.cycleIndex[cell.y]?.[cell.x];
    if (cellI == null || cellI < 0) return false;
    return aheadOfTail(headI, cellI, tailI, n, growing || isFood(state, cell));
  };

  let eat: Direction | null = null;
  for (const dir of DIRS) {
    if (dir === OPPOSITE[state.direction]) continue;
    const cell = cellAt(head, dir);
    if (!isFood(state, cell) || wouldDie(state, dir)) continue;
    eat = dir;
    break;
  }
  if (eat) return eat;

  type PocketMove = { dir: Direction; apples: number; size: number; food: boolean; seen: Set<string> };
  let pocket: PocketMove | null = null;

  for (const dir of DIRS) {
    if (dir === OPPOSITE[state.direction]) continue;
    const cell = cellAt(head, dir);
    if (!isClear(state, cell, blocked) || wouldDie(state, dir)) continue;
    const cellI = state.cycleIndex[cell.y]?.[cell.x];
    if (cellI == null || cellI < 0) continue;
    const willEat = isFood(state, cell);
    if (fill >= EARLY_FILL && !aheadOfTail(headI, cellI, tailI, n, growing || willEat)) continue;
    const info = canFillPocket(state, cell, blocked, head);
    if (!info) continue;
    const better =
      !pocket ||
      info.apples > pocket.apples ||
      (info.apples === pocket.apples && (willEat && !pocket.food || info.size < pocket.size));
    if (better) {
      pocket = { dir, apples: info.apples, size: info.size, food: willEat, seen: info.seen };
    }
  }

  if (pocket && pocket.apples > 0) {
    const earlySweep = pocket.food || pocket.size <= 12;
    if (fill >= EARLY_FILL || earlySweep) return pocket.dir;
  }

  if (fill < EARLY_FILL) {
    const huntOk = (dir: Direction, cell: Point) =>
      hamOk(dir, cell) && !closesSoon(state, head, dir, blocked) && roomAfter(state, cell, blocked);
    const seek = walkToApple(state, head, blocked, null, huntOk);
    if (seek) return seek;
    const fillDir = fillSpaceDir(state, head, blocked, hamOk);
    if (fillDir) return fillDir;
  }

  if (hamOk(cycleDir, cellAt(head, cycleDir)) && !wouldDie(state, cycleDir)) return cycleDir;
  const fillDir = fillSpaceDir(state, head, blocked, hamOk);
  if (fillDir) return fillDir;
  for (const dir of DIRS) {
    if (dir === cycleDir) continue;
    if (!wouldDie(state, dir) && hamOk(dir, cellAt(head, dir))) return dir;
  }
  for (const dir of DIRS) {
    if (!wouldDie(state, dir) && dir !== OPPOSITE[state.direction]) return dir;
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
