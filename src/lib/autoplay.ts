"use client";

import {
  DELTA,
  OPPOSITE,
  type Direction,
  type GameState,
  type Point,
} from "@/lib/engine";

let autoplayOn = false;
let huntAt: Point | null = null;
let huntIdle = 0;
let huntDist = Infinity;

export function isAutoplay() {
  return autoplayOn;
}

export function enableAutoplay() {
  autoplayOn = true;
}

export function autoplayOnNewRun(_tickMs = 104) {
  huntAt = null;
  huntIdle = 0;
  huntDist = Infinity;
}

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

function hasEscape(state: GameState, cell: Point, blocked: Set<string>) {
  const extra = new Set(blocked);
  extra.add(keyOf(cell));
  const empty = state.cols * state.rows - state.snake.length;
  const min = Math.min(80, Math.max(24, Math.floor(empty * 0.25)));
  return floodReach(state, cell, extra, min) >= min;
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

function crowding(state: GameState, food: Point) {
  return state.snake.filter((part) => manhattan(part, food) <= 3).length;
}

function nearestOpenApple(state: GameState, from: Point, skip: Point | null = null) {
  if (state.foods.length === 0) return null;
  let best: Point | null = null;
  let bestScore = Infinity;
  for (const food of state.foods) {
    if (skip && food.x === skip.x && food.y === skip.y) continue;
    const score = manhattan(from, food) * 4 + crowding(state, food) * 3;
    if (score < bestScore) {
      best = food;
      bestScore = score;
    }
  }
  return best ?? (skip ? state.foods.find((food) => food.x !== skip.x || food.y !== skip.y) ?? skip : null);
}

function resolveHunt(state: GameState, from: Point) {
  const fresh = nearestOpenApple(state, from);
  if (!fresh) {
    huntAt = null;
    huntIdle = 0;
    huntDist = Infinity;
    return null;
  }
  if (huntAt && state.foods.some((food) => food.x === huntAt!.x && food.y === huntAt!.y)) {
    const keep = manhattan(from, huntAt);
    const alt = manhattan(from, fresh);
    if (keep <= alt + 2 && crowding(state, huntAt) <= crowding(state, fresh) + 1) {
      return huntAt;
    }
  }
  huntAt = fresh;
  huntIdle = 0;
  huntDist = manhattan(from, huntAt);
  return huntAt;
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

function alongSelf(from: Point, dir: Direction, blocked: Set<string>) {
  const sideA = cellAt(from, TURN_LEFT[dir]);
  const sideB = cellAt(from, TURN_LEFT[TURN_LEFT[TURN_LEFT[dir]]]);
  return blocked.has(keyOf(sideA)) || blocked.has(keyOf(sideB));
}

function minAppleDist(state: GameState, p: Point) {
  if (state.foods.length === 0) return Infinity;
  let best = Infinity;
  for (const food of state.foods) {
    const d = manhattan(p, food);
    if (d < best) best = d;
  }
  return best;
}

function huntDir(
  state: GameState,
  from: Point,
  goal: Point,
  blocked: Set<string>,
  cycleDir: Direction,
  hamOk: (dir: Direction, cell: Point) => boolean,
): Direction | null {
  const noGo = OPPOSITE[state.direction];
  const here = manhattan(from, goal);
  const hereAny = minAppleDist(state, from);
  const preferH = Math.abs(goal.x - from.x) >= Math.abs(goal.y - from.y);
  const closer: { dir: Direction; man: number }[] = [];
  const safe: { dir: Direction; man: number; any: number }[] = [];
  for (const dir of DIRS) {
    if (dir === noGo) continue;
    const cell = cellAt(from, dir);
    if (!isClear(state, cell, blocked) || !hamOk(dir, cell)) continue;
    const man = manhattan(cell, goal);
    const any = minAppleDist(state, cell);
    safe.push({ dir, man, any });
    if (man < here) closer.push({ dir, man });
  }
  const breakout = safe
    .filter((opt) => !alongSelf(from, opt.dir, blocked) && opt.any < hereAny)
    .sort((a, b) => a.any - b.any || a.man - b.man);
  if (breakout.length > 0 && (closer.length === 0 || closer.every((opt) => alongSelf(from, opt.dir, blocked)))) {
    return breakout[0].dir;
  }
  if (closer.length === 0) return null;
  const horiz = (dir: Direction) => dir === "left" || dir === "right";
  closer.sort((a, b) => {
    const pinA = alongSelf(from, a.dir, blocked) ? 1 : 0;
    const pinB = alongSelf(from, b.dir, blocked) ? 1 : 0;
    if (pinA !== pinB) return pinA - pinB;
    if (a.man !== b.man) return a.man - b.man;
    if (horiz(a.dir) !== horiz(b.dir)) {
      if (preferH) return horiz(a.dir) ? -1 : 1;
      return horiz(a.dir) ? 1 : -1;
    }
    if (a.dir === cycleDir) return 1;
    if (b.dir === cycleDir) return -1;
    return 0;
  });
  return closer[0].dir;
}

function astarDir(
  state: GameState,
  from: Point,
  goal: Point,
  blocked: Set<string>,
  hamOk: (dir: Direction, cell: Point) => boolean,
): Direction | null {
  const noGo = OPPOSITE[state.direction];
  type Node = { x: number; y: number; first: Direction; g: number };
  const best = new Map<string, number>();
  const open: Node[] = [];
  for (const dir of DIRS) {
    if (dir === noGo) continue;
    const p = { x: from.x + DELTA[dir].x, y: from.y + DELTA[dir].y };
    if (!isClear(state, p, blocked) || !hamOk(dir, p)) continue;
    if (p.x === goal.x && p.y === goal.y) return dir;
    const id = keyOf(p);
    best.set(id, 1);
    open.push({ x: p.x, y: p.y, first: dir, g: 1 });
  }
  while (open.length) {
    let pick = 0;
    let pickF = Infinity;
    for (let i = 0; i < open.length; i += 1) {
      const n = open[i];
      const f = n.g + Math.abs(goal.x - n.x) + Math.abs(goal.y - n.y);
      if (f < pickF) {
        pickF = f;
        pick = i;
      }
    }
    const cur = open.splice(pick, 1)[0];
    for (const dir of DIRS) {
      const x = cur.x + DELTA[dir].x;
      const y = cur.y + DELTA[dir].y;
      const p = { x, y };
      if (!isClear(state, p, blocked)) continue;
      if (x === goal.x && y === goal.y) return cur.first;
      const id = keyOf(p);
      const g = cur.g + 1;
      if (g >= (best.get(id) ?? Infinity)) continue;
      best.set(id, g);
      open.push({ x, y, first: cur.first, g });
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

  const fill = state.snake.length / n;
  const growing = state.pendingGrow > 0;
  const blocked = snakeKeys(state, growing);
  const hamOk = (dir: Direction, cell: Point) => {
    if (dir === OPPOSITE[state.direction]) return false;
    if (!isClear(state, cell, blocked)) return false;
    if (fill < EARLY_FILL) return hasEscape(state, cell, blocked);
    const cellI = state.cycleIndex[cell.y]?.[cell.x];
    if (cellI == null || cellI < 0) return false;
    return aheadOfTail(headI, cellI, tailI, n, growing || isFood(state, cell));
  };

  let eat: Direction | null = null;
  for (const dir of DIRS) {
    if (dir === OPPOSITE[state.direction]) continue;
    const cell = { x: head.x + DELTA[dir].x, y: head.y + DELTA[dir].y };
    if (!isClear(state, cell, blocked) || !isFood(state, cell)) continue;
    if (!hamOk(dir, cell)) continue;
    eat = dir;
    break;
  }
  if (eat) return eat;

  let hunt = fill < EARLY_FILL ? resolveHunt(state, head) : null;
  if (fill >= EARLY_FILL) {
    huntAt = null;
    huntIdle = 0;
    huntDist = Infinity;
  } else if (hunt) {
    const d = manhattan(head, hunt);
    if (d >= huntDist) huntIdle += 1;
    else huntIdle = 0;
    huntDist = d;
    if (huntIdle >= 6) {
      const skip = hunt;
      huntAt = null;
      huntIdle = 0;
      huntDist = Infinity;
      hunt = nearestOpenApple(state, head, skip);
      huntAt = hunt;
    }
  }

  type PocketMove = { dir: Direction; apples: number; size: number; food: boolean; seen: Set<string> };
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
      pocket = { dir, apples: info.apples, size: info.size, food: willEat, seen: info.seen };
    }
  }

  if (pocket && pocket.apples > 0) {
    const huntInPocket = hunt ? pocket.seen.has(keyOf(hunt)) : false;
    const earlySweep = huntInPocket && (pocket.food || pocket.size <= 12);
    if (fill >= EARLY_FILL || earlySweep) return pocket.dir;
  }

  if (hunt) {
    const seek =
      huntDir(state, head, hunt, blocked, cycleDir, hamOk) ??
      astarDir(state, head, hunt, blocked, hamOk);
    if (seek) return seek;
    const other = nearestOpenApple(state, head, hunt);
    if (other && (other.x !== hunt.x || other.y !== hunt.y)) {
      huntAt = other;
      const retry =
        huntDir(state, head, other, blocked, cycleDir, hamOk) ??
        astarDir(state, head, other, blocked, hamOk);
      if (retry) return retry;
    }
    let bestDir: Direction | null = null;
    let bestAny = minAppleDist(state, head);
    for (const dir of DIRS) {
      const cell = cellAt(head, dir);
      if (!hamOk(dir, cell)) continue;
      const any = minAppleDist(state, cell);
      if (any < bestAny) {
        bestAny = any;
        bestDir = dir;
      }
    }
    if (bestDir) return bestDir;
  }

  const cycleCell = { x: head.x + DELTA[cycleDir].x, y: head.y + DELTA[cycleDir].y };
  if (hamOk(cycleDir, cycleCell)) return cycleDir;
  for (const dir of DIRS) {
    if (dir === cycleDir) continue;
    const cell = { x: head.x + DELTA[dir].x, y: head.y + DELTA[dir].y };
    if (hamOk(dir, cell)) return dir;
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
