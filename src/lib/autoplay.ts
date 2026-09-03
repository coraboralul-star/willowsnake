"use client";

import {
  DELTA,
  OPPOSITE,
  type Direction,
  type GameState,
  type Point,
} from "@/lib/engine";

const DIRS: Direction[] = ["up", "right", "down", "left"];
const CYCLE_CACHE = new Map<number, Cycle>();

type Cycle = {
  index: number[][];
  next: Point[][];
  length: number;
};

type Move = { dir: Direction; next: Point };

let autoplayOn = false;
let activeChase: Point | null = null;
let roamTicksLeft = 0;
let roamHeading: Direction | null = null;

export function isAutoplay() {
  return autoplayOn;
}

function resetHunt() {
  activeChase = null;
}

function hasEscape(state: GameState) {
  const moves = legalMoves(state, state.queued.at(-1) ?? state.direction);
  for (const move of moves) {
    const next = peek(state, move.dir);
    if (next && legalMoves(next, next.direction).length > 0) return true;
  }
  return false;
}

export function enableAutoplay() {
  autoplayOn = true;
  resetHunt();
}

export function autoplayOnNewRun(tickMs = 120) {
  if (!autoplayOn) return;
  resetHunt();
  roamHeading = null;
  roamTicksLeft = Math.max(3, Math.round((300 + Math.random() * 200) / tickMs));
}

function key(p: Point) {
  return `${p.x},${p.y}`;
}

function add(p: Point, dir: Direction): Point {
  const d = DELTA[dir];
  return { x: p.x + d.x, y: p.y + d.y };
}

function inBounds(p: Point, n: number) {
  return p.x >= 0 && p.y >= 0 && p.x < n && p.y < n;
}

function manhattan(a: Point, b: Point) {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

function dirBetween(a: Point, b: Point): Direction | null {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  if (dx === 1 && dy === 0) return "right";
  if (dx === -1 && dy === 0) return "left";
  if (dy === 1 && dx === 0) return "down";
  if (dy === -1 && dx === 0) return "up";
  return null;
}

function cycleNextPoint(x: number, y: number, n: number): Point {
  if (y === 0) {
    if (x === 0) return { x: 0, y: 1 };
    return { x: x - 1, y: 0 };
  }
  if (x % 2 === 0) {
    if (y === n - 1) return { x: x + 1, y };
    return { x, y: y + 1 };
  }
  if (y === 1) {
    if (x === n - 1) return { x, y: 0 };
    return { x: x + 1, y };
  }
  return { x, y: y - 1 };
}

function getCycle(n: number): Cycle {
  const cached = CYCLE_CACHE.get(n);
  if (cached) return cached;

  const length = n * n;
  const index = Array.from({ length: n }, () => Array<number>(n).fill(-1));
  const next = Array.from({ length: n }, () => Array<Point>(n));
  let p = { x: 0, y: 0 };

  for (let i = 0; i < length; i += 1) {
    index[p.y][p.x] = i;
    const nxt = cycleNextPoint(p.x, p.y, n);
    next[p.y][p.x] = nxt;
    p = nxt;
  }

  const cycle = { index, next, length };
  CYCLE_CACHE.set(n, cycle);
  return cycle;
}

function cycleDist(from: number, to: number, length: number) {
  return (to - from + length) % length;
}

function occupiedAfter(state: GameState, next?: Point) {
  const grow = next != null && next.x === state.food.x && next.y === state.food.y;
  const body = grow ? state.snake : state.snake.slice(0, -1);
  return new Set(body.map(key));
}

function orderedDirs(from: Point, goal: Point): Direction[] {
  const dx = Math.sign(goal.x - from.x);
  const dy = Math.sign(goal.y - from.y);
  const horiz: Direction | null = dx > 0 ? "right" : dx < 0 ? "left" : null;
  const vert: Direction | null = dy > 0 ? "down" : dy < 0 ? "up" : null;
  const preferred: Direction[] = [];
  if (horiz && vert) {
    if ((from.x + from.y) % 2 === 0) preferred.push(horiz, vert);
    else preferred.push(vert, horiz);
  } else {
    if (horiz) preferred.push(horiz);
    if (vert) preferred.push(vert);
  }
  for (const dir of DIRS) {
    if (!preferred.includes(dir)) preferred.push(dir);
  }
  return preferred;
}

function bfsPath(start: Point, goal: Point, blocked: Set<string>, n: number): Point[] | null {
  if (start.x === goal.x && start.y === goal.y) return [];
  const seen = new Set<string>([key(start)]);
  const queue: Point[] = [start];
  const prev = new Map<string, string>();

  while (queue.length) {
    const cur = queue.shift();
    if (!cur) break;
    for (const dir of orderedDirs(cur, goal)) {
      const nxt = add(cur, dir);
      if (!inBounds(nxt, n)) continue;
      const id = key(nxt);
      const isGoal = nxt.x === goal.x && nxt.y === goal.y;
      if (seen.has(id) || (blocked.has(id) && !isGoal)) continue;
      seen.add(id);
      prev.set(id, key(cur));
      if (isGoal) {
        const path: Point[] = [nxt];
        let step = id;
        while (prev.get(step) && prev.get(step) !== key(start)) {
          step = prev.get(step) as string;
          const [x, y] = step.split(",").map(Number);
          path.push({ x, y });
        }
        path.reverse();
        return path;
      }
      queue.push(nxt);
    }
  }

  return null;
}

function bodyBlocks(body: Point[], p: Point, arriveAt: number) {
  for (let i = 0; i < body.length; i += 1) {
    if (body[i].x === p.x && body[i].y === p.y && arriveAt < body.length - i) {
      return true;
    }
  }
  return false;
}

function timedBfsPath(state: GameState): Point[] | null {
  const n = state.gridSize;
  const start = state.snake[0];
  const goal = state.food;
  if (goal.x < 0 || goal.y < 0) return null;
  if (start.x === goal.x && start.y === goal.y) return [];

  const seen = new Set<string>([key(start)]);
  const queue: Point[] = [start];
  const prev = new Map<string, string>();
  const dist = new Map<string, number>([[key(start), 0]]);

  while (queue.length) {
    const cur = queue.shift();
    if (!cur) break;
    const t = dist.get(key(cur)) ?? 0;
    for (const dir of orderedDirs(cur, goal)) {
      const nxt = add(cur, dir);
      if (!inBounds(nxt, n)) continue;
      const id = key(nxt);
      if (seen.has(id)) continue;
      const isGoal = nxt.x === goal.x && nxt.y === goal.y;
      if (!isGoal && bodyBlocks(state.snake, nxt, t + 1)) continue;
      seen.add(id);
      prev.set(id, key(cur));
      dist.set(id, t + 1);
      if (isGoal) {
        const path: Point[] = [nxt];
        let step = id;
        while (prev.get(step) && prev.get(step) !== key(start)) {
          step = prev.get(step) as string;
          const [x, y] = step.split(",").map(Number);
          path.push({ x, y });
        }
        path.reverse();
        return path;
      }
      queue.push(nxt);
    }
  }

  return null;
}

function pathFirstStep(state: GameState, path: Point[] | null, fill: number): Direction | null {
  if (!path || path.length === 0) return null;
  const facing = state.queued.at(-1) ?? state.direction;
  const need = fill < 0.12 ? 0.86 : 0.93;

  let g: GameState | null = state;
  for (const cell of path) {
    if (!g) return null;
    const dir = dirBetween(g.snake[0], cell);
    if (!dir || dir === OPPOSITE[g.direction]) return null;
    g = peek(g, dir);
    if (!g || !hasEscape(g) || !spaceOk(g, need)) return null;
  }
  if (!g || !chaseSafe(g, fill)) return null;

  const first = dirBetween(state.snake[0], path[0]);
  if (!first || first === OPPOSITE[facing]) return null;
  return first;
}

function areaAfter(state: GameState, dir: Direction) {
  const next = peek(state, dir);
  if (!next) return -1;
  const blocked = new Set(next.snake.slice(0, -1).map(key));
  return flood(next.snake[0], blocked, next.gridSize);
}

function pickFastestSafe(state: GameState, moves: Move[], fill: number): Direction | null {
  let maxArea = 0;
  for (const move of moves) {
    maxArea = Math.max(maxArea, areaAfter(state, move.dir));
  }
  const minArea = Math.max(4, Math.floor(maxArea * 0.72));

  const roomy = (dir: Direction) => {
    const area = areaAfter(state, dir);
    return area >= minArea;
  };

  const path =
    timedBfsPath(state) ??
    bfsPath(state.snake[0], state.food, occupiedAfter(state), state.gridSize);
  const first = pathFirstStep(state, path, fill);
  if (first && moves.some((move) => move.dir === first) && roomy(first)) {
    activeChase = { x: state.food.x, y: state.food.y };
    return first;
  }

  let best: Direction | null = null;
  let bestLen = Infinity;
  for (const move of moves) {
    if (!roomy(move.dir)) continue;
    const next = peek(state, move.dir);
    if (!next || !hasEscape(next) || !chaseSafe(next, fill)) continue;
    if (move.next.x === state.food.x && move.next.y === state.food.y) {
      activeChase = { x: state.food.x, y: state.food.y };
      return move.dir;
    }
    const rest = timedBfsPath(next);
    if (!rest) continue;
    if (pathFirstStep(next, rest, fill) == null) continue;
    if (rest.length < bestLen) {
      bestLen = rest.length;
      best = move.dir;
    }
  }
  if (best) {
    activeChase = { x: state.food.x, y: state.food.y };
    return best;
  }
  return null;
}

function legalMoves(state: GameState, facing: Direction): Move[] {
  const n = state.gridSize;
  const head = state.snake[0];
  const moves: Move[] = [];

  for (const dir of DIRS) {
    if (dir === OPPOSITE[facing]) continue;
    const next = add(head, dir);
    if (!inBounds(next, n)) continue;
    if (occupiedAfter(state, next).has(key(next))) continue;
    moves.push({ dir, next });
  }

  return moves;
}

function peek(state: GameState, dir: Direction): GameState | null {
  const n = state.gridSize;
  const nextHead = add(state.snake[0], dir);
  if (!inBounds(nextHead, n)) return null;

  const eating = nextHead.x === state.food.x && nextHead.y === state.food.y;
  const body = eating ? state.snake : state.snake.slice(0, -1);
  if (body.some((p) => p.x === nextHead.x && p.y === nextHead.y)) return null;

  const snake = [nextHead, ...state.snake];
  if (!eating) snake.pop();

  return {
    ...state,
    snake,
    direction: dir,
    queued: [],
    food: eating ? { x: -1, y: -1 } : state.food,
    score: eating ? state.score + 1 : state.score,
  };
}

function cycleSafe(state: GameState) {
  const n = state.gridSize;
  const cycle = getCycle(n);
  const cap = n * n;
  const xs = new Int16Array(cap + 2);
  const ys = new Int16Array(cap + 2);
  let len = state.snake.length;
  for (let i = 0; i < len; i += 1) {
    xs[i] = state.snake[i].x;
    ys[i] = state.snake[i].y;
  }

  let dir = state.direction;
  let foodX = state.food.x;
  let foodY = state.food.y;

  for (let stepI = 0; stepI < cap + 2; stepI += 1) {
    if (len >= cap) return true;
    const follow = cycle.next[ys[0]][xs[0]];
    const nextDir = dirBetween({ x: xs[0], y: ys[0] }, follow);
    if (!nextDir || nextDir === OPPOSITE[dir]) return false;

    const nx = xs[0] + DELTA[nextDir].x;
    const ny = ys[0] + DELTA[nextDir].y;
    if (nx < 0 || ny < 0 || nx >= n || ny >= n) return false;

    const eating = nx === foodX && ny === foodY;
    const bodyLen = eating ? len : len - 1;
    for (let i = 0; i < bodyLen; i += 1) {
      if (xs[i] === nx && ys[i] === ny) return false;
    }

    const nextLen = eating ? len + 1 : len;
    for (let i = nextLen - 1; i > 0; i -= 1) {
      xs[i] = xs[i - 1];
      ys[i] = ys[i - 1];
    }
    xs[0] = nx;
    ys[0] = ny;
    len = nextLen;
    if (eating) {
      foodX = -1;
      foodY = -1;
    }
    dir = nextDir;
  }

  return true;
}

function flood(start: Point, blocked: Set<string>, n: number) {
  const seen = new Set<string>([key(start)]);
  const stack = [start];
  let count = 0;

  while (stack.length) {
    const cur = stack.pop();
    if (!cur) break;
    count += 1;
    for (const dir of DIRS) {
      const nxt = add(cur, dir);
      if (!inBounds(nxt, n)) continue;
      const id = key(nxt);
      if (seen.has(id) || blocked.has(id)) continue;
      seen.add(id);
      stack.push(nxt);
    }
  }

  return count;
}

function canReach(start: Point, goal: Point, blocked: Set<string>, n: number) {
  if (start.x === goal.x && start.y === goal.y) return true;
  const seen = new Set<string>([key(start)]);
  const queue: Point[] = [start];

  while (queue.length) {
    const cur = queue.shift();
    if (!cur) break;
    for (const dir of DIRS) {
      const nxt = add(cur, dir);
      if (!inBounds(nxt, n)) continue;
      const id = key(nxt);
      if (nxt.x === goal.x && nxt.y === goal.y) return true;
      if (seen.has(id) || blocked.has(id)) continue;
      seen.add(id);
      queue.push(nxt);
    }
  }

  return false;
}

function spaceOk(state: GameState, need = 0.9) {
  const n = state.gridSize;
  const tail = state.snake[state.snake.length - 1];
  const blocked = new Set(state.snake.slice(0, -1).map(key));
  const empty = n * n - (state.snake.length - 1);
  const area = flood(state.snake[0], blocked, n);
  return canReach(state.snake[0], tail, blocked, n) && area >= Math.floor(empty * need);
}

function isYoung(state: GameState) {
  const fill = state.snake.length / (state.gridSize * state.gridSize);
  return state.snake.length <= 20 && fill < 0.2;
}

function chaseSafe(after: GameState, fill: number) {
  if (!hasEscape(after)) return false;
  if (isYoung(after) || fill < 0.12) return spaceOk(after, 0.9);
  return spaceOk(after, 0.94) && cycleSafe(after);
}

function snakeOnArc(state: GameState, cycle: Cycle) {
  const headI = cycle.index[state.snake[0].y][state.snake[0].x];
  for (let i = 0; i < state.snake.length; i += 1) {
    const expected = (headI - i + cycle.length) % cycle.length;
    const p = state.snake[i];
    if (cycle.index[p.y][p.x] !== expected) return false;
  }
  return true;
}

function scoreMove(state: GameState, move: Move, facing: Direction, cycle: Cycle) {
  const head = state.snake[0];
  const headI = cycle.index[head.y][head.x];
  const ahead = cycleDist(headI, cycle.index[move.next.y][move.next.x], cycle.length);
  const man = manhattan(move.next, state.food);
  const closer = man < manhattan(head, state.food) ? 1 : 0;
  const turn = move.dir !== facing ? 1 : 0;
  const stair =
    state.food.x !== head.x && state.food.y !== head.y && turn && closer ? 1 : 0;
  const onFood = move.next.x === state.food.x && move.next.y === state.food.y ? 1 : 0;

  return onFood * 8000 + closer * 120 + stair * 90 + turn * 16 + ahead * 3 - man * 8;
}

function isProgress(state: GameState, move: Move, cycle: Cycle, foodAhead: number) {
  if (move.next.x === state.food.x && move.next.y === state.food.y) return true;
  const headI = cycle.index[state.snake[0].y][state.snake[0].x];
  const ahead = cycleDist(headI, cycle.index[move.next.y][move.next.x], cycle.length);
  return ahead > 0 && ahead <= foodAhead;
}

function safeRoamMove(state: GameState, move: Move | undefined) {
  if (!move) return null;
  const next = peek(state, move.dir);
  if (next && cycleSafe(next)) return move.dir;
  return null;
}

function pickRoamDir(state: GameState, moves: Move[], facing: Direction): Direction {
  const heading = roamHeading ?? facing;
  const straight = moves.find((move) => move.dir === heading);
  const keep = safeRoamMove(state, straight);
  if (keep) {
    roamHeading = keep;
    return keep;
  }

  const turns = moves.filter((move) => move.dir !== heading);
  for (let i = turns.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const swap = turns[i];
    turns[i] = turns[j];
    turns[j] = swap;
  }
  for (const move of turns) {
    const dir = safeRoamMove(state, move);
    if (dir) {
      roamHeading = dir;
      return dir;
    }
  }

  roamHeading = facing;
  return facing;
}

export function pickAutoplayDir(state: GameState): Direction {
  const facing = state.queued.at(-1) ?? state.direction;
  const moves = legalMoves(state, facing);
  if (moves.length === 0) return facing;

  if (roamTicksLeft > 0) {
    roamTicksLeft -= 1;
    return pickRoamDir(state, moves, facing);
  }

  const cycle = getCycle(state.gridSize);
  const head = state.snake[0];
  const foodAhead = cycleDist(
    cycle.index[head.y][head.x],
    cycle.index[state.food.y][state.food.x],
    cycle.length,
  );
  const follow = cycle.next[head.y][head.x];
  const followMove = moves.find(
    (move) => move.next.x === follow.x && move.next.y === follow.y,
  );
  const ranked = [...moves].sort(
    (a, b) => scoreMove(state, b, facing, cycle) - scoreMove(state, a, facing, cycle),
  );
  const progress = ranked.filter((move) => isProgress(state, move, cycle, foodAhead));

  const fill = state.snake.length / (state.gridSize * state.gridSize);
  const onArc = snakeOnArc(state, cycle);
  const followPeek = followMove ? peek(state, followMove.dir) : null;
  const followOk =
    followPeek != null && hasEscape(followPeek) && cycleSafe(followPeek);
  const young = isYoung(state);

  if (young || onArc || activeChase) {
    const hunt = pickFastestSafe(state, moves, fill);
    if (hunt) {
      if (young) return hunt;
      const pathLen = timedBfsPath(state)?.length ?? Number.POSITIVE_INFINITY;
      if (pathLen <= foodAhead) return hunt;
    } else {
      activeChase = null;
    }
  }

  if (followOk && followMove) return followMove.dir;

  const tryMove = (move: Move | undefined, loose = false) => {
    if (!move) return null;
    const next = peek(state, move.dir);
    if (!next || !hasEscape(next)) return null;
    if (loose) return spaceOk(next, 0.8) ? move.dir : null;
    if (fill < 0.46) {
      if (chaseSafe(next, fill)) return move.dir;
      return null;
    }
    if (cycleSafe(next) && spaceOk(next, 0.94)) return move.dir;
    return null;
  };

  for (const move of progress) {
    const dir = tryMove(move);
    if (dir) return dir;
  }

  const followDir = tryMove(followMove);
  if (followDir) return followDir;

  for (const move of ranked) {
    const dir = tryMove(move);
    if (dir) return dir;
  }

  for (const move of ranked) {
    const dir = tryMove(move, true);
    if (dir) return dir;
  }

  let bestArea = -1;
  let bestDir: Direction | null = null;
  for (const move of moves) {
    const next = peek(state, move.dir);
    if (!next || !hasEscape(next) || !spaceOk(next, 0.8)) continue;
    const blocked = new Set(next.snake.slice(0, -1).map(key));
    const area = flood(next.snake[0], blocked, next.gridSize);
    if (area > bestArea) {
      bestArea = area;
      bestDir = move.dir;
    }
  }
  if (bestDir) return bestDir;

  for (const move of moves) {
    if (peek(state, move.dir)) return move.dir;
  }

  return facing;
}

export function applyAutoplayDir(state: GameState, dir: Direction): GameState {
  if (dir === OPPOSITE[state.direction] || dir === state.direction) {
    return { ...state, queued: [] };
  }
  return { ...state, queued: [dir] };
}

export const DIR_TO_KEY = {
  up: "w",
  down: "s",
  left: "a",
  right: "d",
} as const;
