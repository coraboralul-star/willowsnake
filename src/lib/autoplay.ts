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

export function enableAutoplay() {
  autoplayOn = true;
  activeChase = null;
}

export function autoplayOnNewRun(tickMs = 120) {
  if (!autoplayOn) return;
  activeChase = null;
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

function spaceOk(state: GameState) {
  const n = state.gridSize;
  const tail = state.snake[state.snake.length - 1];
  const blocked = new Set(state.snake.slice(0, -1).map(key));
  const empty = n * n - (state.snake.length - 1);
  const area = flood(state.snake[0], blocked, n);
  return canReach(state.snake[0], tail, blocked, n) && area >= Math.floor(empty * 0.9);
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

function chaseFirstStep(state: GameState, foodAhead: number, cycle: Cycle): Direction | null {
  const n = state.gridSize;
  const fill = state.snake.length / (n * n);
  if (state.score === 0 && state.snake.length <= 4) activeChase = null;

  const sameFood =
    activeChase != null &&
    activeChase.x === state.food.x &&
    activeChase.y === state.food.y;
  if (!sameFood) activeChase = null;

  const onArc = snakeOnArc(state, cycle);
  const canStart = state.snake.length <= 8 || (onArc && fill < 0.52);
  if (!activeChase && !canStart) return null;

  const facing = state.queued.at(-1) ?? state.direction;
  const path = bfsPath(state.snake[0], state.food, occupiedAfter(state), n);
  if (!path || path.length === 0 || path.length > foodAhead) {
    activeChase = null;
    return null;
  }

  let g: GameState | null = state;
  for (const cell of path) {
    if (!g) return null;
    const dir = dirBetween(g.snake[0], cell);
    if (!dir || dir === OPPOSITE[g.direction]) {
      activeChase = null;
      return null;
    }
    g = peek(g, dir);
  }
  if (!g || !cycleSafe(g) || !spaceOk(g)) {
    activeChase = null;
    return null;
  }

  const first = dirBetween(state.snake[0], path[0]);
  if (!first || first === OPPOSITE[facing]) {
    activeChase = null;
    return null;
  }

  activeChase = { x: state.food.x, y: state.food.y };
  return first;
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

  const chase = chaseFirstStep(state, foodAhead, cycle);
  if (chase && moves.some((move) => move.dir === chase)) return chase;

  const tryMove = (move: Move | undefined) => {
    if (!move) return null;
    const next = peek(state, move.dir);
    if (next && cycleSafe(next)) return move.dir;
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

  return followMove?.dir ?? facing;
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
