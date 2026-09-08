import { cycleIndex, cyclePrev, generateCycleNext } from "@/lib/hamilton";

export type Point = { x: number; y: number };
export type Direction = "up" | "down" | "left" | "right";
export type GameStatus = "idle" | "playing" | "paused" | "over" | "won";
export const BOARD_COLS = 20;
export const BOARD_ROWS = 20;

export const KEY_TO_DIR: Record<string, Direction> = {
  w: "up",
  a: "left",
  s: "down",
  d: "right",
  W: "up",
  A: "left",
  S: "down",
  D: "right",
};

export type FoodKind = "apple" | "golden" | "heart";
export type Food = Point & { kind: FoodKind; from?: string };

export type GameState = {
  cols: number;
  rows: number;
  gridSize: number;
  snake: Point[];
  prevSnake: Point[];
  direction: Direction;
  queued: Direction[];
  foods: Food[];
  cycleNext: Point[][];
  cycleIndex: number[][];
  score: number;
  status: GameStatus;
  tickStartedAt: number;
  tickMs: number;
  pauseT: number;
  ateAt: number;
  foodAt: number;
  pendingGrow: number;
  glowUntil: number;
  nitroUntil: number;
  slowUntil: number;
  hijacked: boolean;
  hijackStartedAt: number;
  hijackUntil: number;
};

export const DELTA: Record<Direction, Point> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

export const OPPOSITE: Record<Direction, Direction> = {
  up: "down",
  down: "up",
  left: "right",
  right: "left",
};

export const CELLS_PER_SEC = 15;
export const BASE_TICK = Math.round(1000 / CELLS_PER_SEC);
export const MIN_TICK = 50;
export const NITRO_TICK = 50;
export const SLOW_TICK = 140;
export const HIJACK_MS = 14400;
export const RANDOM_FOOD_AT = 220;
const FOOD_AHEAD_MIN = CELLS_PER_SEC;
const FOOD_AHEAD_MAX = CELLS_PER_SEC * 4;
const FOOD_AHEAD_GAP = 10;

export function foodTarget(cols: number, rows: number, snakeLen = 0) {
  const room = Math.max(0, cols * rows - snakeLen);
  if (room === 0) return 0;
  const want = snakeLen >= RANDOM_FOOD_AT ? 2 : Math.random() < 0.4 ? 1 : 2;
  return Math.min(want, room);
}

function dirOf(from: Point, to: Point): Direction {
  if (to.x === from.x + 1) return "right";
  if (to.x === from.x - 1) return "left";
  if (to.y === from.y + 1) return "down";
  return "up";
}

function foodKey(p: Point) {
  return `${p.x},${p.y}`;
}

function nearFood(a: Point, b: Point) {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)) === 1;
}

function wouldBunch(foods: Point[], cell: Point) {
  const neighbors = foods.filter((food) => nearFood(food, cell));
  if (neighbors.length >= 2) return true;
  if (neighbors.length === 1) {
    const pal = neighbors[0];
    if (foods.some((food) => (food.x !== pal.x || food.y !== pal.y) && nearFood(food, pal))) {
      return true;
    }
  }
  return false;
}

export function createGame(cols: number, rows = cols): GameState {
  const cycleNext = generateCycleNext(cols, rows);
  const prev = cyclePrev(cycleNext, cols, rows);
  const idx = cycleIndex(cycleNext, cols, rows);
  const head = { x: 0, y: 0 };
  const neck = prev[head.y][head.x];
  const tail = prev[neck.y][neck.x];
  const snake: Point[] = [head, neck, tail];
  const direction = dirOf(head, cycleNext[head.y][head.x]);

  return {
    cols,
    rows,
    gridSize: cols,
    snake,
    prevSnake: snake.map((p) => ({ ...p })),
    direction,
    queued: [],
    foods: spawnFoods(snake, [], cols, rows, { cycleIndex: idx, head }),
    cycleNext,
    cycleIndex: idx,
    score: 0,
    status: "idle",
    tickStartedAt: 0,
    tickMs: BASE_TICK,
    pauseT: 1,
    ateAt: 0,
    foodAt: 0,
    pendingGrow: 0,
    glowUntil: 0,
    nitroUntil: 0,
    slowUntil: 0,
    hijacked: false,
    hijackStartedAt: 0,
    hijackUntil: 0,
  };
}

export function queueDirection(state: GameState, dir: Direction): GameState {
  const last = state.queued.at(-1) ?? state.direction;
  if (dir === last || dir === OPPOSITE[last]) return state;
  if (state.queued.length >= 2) return state;
  return { ...state, queued: [...state.queued, dir] };
}

export function enqueueTurn(state: GameState, dir: Direction): GameState {
  return queueDirection(state, dir);
}

export function startRun(state: GameState, now: number, dir?: Direction): GameState {
  let next: GameState = { ...state, status: "playing" };
  if (dir) next = queueDirection(next, dir);
  next = step(next, now);
  next.tickStartedAt = now;
  return next;
}

export function step(state: GameState, now = state.tickStartedAt + state.tickMs): GameState {
  const queued = [...state.queued];
  const direction = queued.shift() ?? state.direction;
  const head = state.snake[0];
  const delta = DELTA[direction];
  const nextHead = { x: head.x + delta.x, y: head.y + delta.y };

  if (
    nextHead.x < 0 ||
    nextHead.y < 0 ||
    nextHead.x >= state.cols ||
    nextHead.y >= state.rows
  ) {
    return { ...state, status: "over", prevSnake: clonePoints(state.snake), queued };
  }

  const eaten = state.foods.find((food) => food.x === nextHead.x && food.y === nextHead.y);
  const eating = eaten != null;
  const body = eating || state.pendingGrow > 0 ? state.snake : state.snake.slice(0, -1);
  if (body.some((p) => p.x === nextHead.x && p.y === nextHead.y)) {
    return { ...state, status: "over", prevSnake: clonePoints(state.snake), queued };
  }

  const snake = [nextHead, ...state.snake];
  let pendingGrow = state.pendingGrow;
  if (eating) {
    const bonus = eaten.kind === "golden" ? 2 : 0;
    pendingGrow += bonus;
  } else if (pendingGrow > 0) {
    pendingGrow -= 1;
  } else {
    snake.pop();
  }

  const filled = snake.length >= state.cols * state.rows;
  const foods = eating
    ? spawnFoods(
        snake,
        state.foods.filter((food) => food.x !== nextHead.x || food.y !== nextHead.y),
        state.cols,
        state.rows,
        { cycleIndex: state.cycleIndex, head: snake[0] },
      )
    : state.foods;

  const nitroUntil = state.nitroUntil && now >= state.nitroUntil ? 0 : state.nitroUntil;
  const slowUntil = state.slowUntil && now >= state.slowUntil ? 0 : state.slowUntil;
  const tickMs = nitroUntil ? NITRO_TICK : slowUntil ? SLOW_TICK : BASE_TICK;

  return {
    ...state,
    prevSnake: clonePoints(state.snake),
    snake,
    direction,
    queued,
    foods,
    score: eating ? state.score + (eaten.kind === "golden" ? 3 : 1) : state.score,
    tickMs,
    pendingGrow,
    nitroUntil,
    slowUntil,
    status: filled ? "won" : state.status,
    ateAt: eating ? now : state.ateAt,
    foodAt: eating ? now : state.foodAt,
  };
}

export function ribbonPath(prev: Point[], curr: Point[], t: number): Point[] {
  if (curr.length === 0) return [];

  const from = prev.length > 0 ? prev : curr;
  const points: Point[] = [lerp(from[0], curr[0], t)];
  const growing = curr.length > from.length;

  if (growing) {
    for (let i = 0; i < from.length; i += 1) points.push(from[i]);
  } else {
    for (let i = 0; i < from.length - 1; i += 1) points.push(from[i]);
    points.push(lerp(from[from.length - 1], curr[curr.length - 1], t));
  }

  return insertCorners(dedupe(points));
}

export function spinePath(prev: Point[], curr: Point[], t: number): Point[] {
  return ribbonPath(prev, curr, t);
}

type CycleHint = { cycleIndex: number[][]; head: Point };

function invertCycle(cycleIndex: number[][], cols: number, rows: number): Point[] {
  const at: Point[] = new Array(cols * rows);
  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < cols; x += 1) {
      at[cycleIndex[y][x]] = { x, y };
    }
  }
  return at;
}

function cycleAhead(index: number[][], head: Point, cell: Point, n: number) {
  return (index[cell.y][cell.x] - index[head.y][head.x] + n) % n;
}

function cycleGap(a: number, b: number, n: number) {
  const d = Math.abs(a - b) % n;
  return Math.min(d, n - d);
}

function pickEmpty(foods: Food[], cols: number, rows: number, taken: Set<string>): Point | null {
  const spaced: Point[] = [];
  const any: Point[] = [];
  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < cols; x += 1) {
      if (taken.has(`${x},${y}`)) continue;
      const cell = { x, y };
      any.push(cell);
      if (!wouldBunch(foods, cell)) spaced.push(cell);
    }
  }
  const pool = spaced.length > 0 ? spaced : any;
  if (pool.length === 0) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}

function pickAlongCycle(
  snake: Point[],
  foods: Food[],
  cols: number,
  rows: number,
  taken: Set<string>,
  along: CycleHint,
): Point | null {
  const n = cols * rows;
  const { cycleIndex, head } = along;
  const headI = cycleIndex[head.y]?.[head.x];
  if (headI == null || headI < 0) return pickEmpty(foods, cols, rows, taken);

  const at = invertCycle(cycleIndex, cols, rows);
  const existing = foods.map((food) => cycleAhead(cycleIndex, head, food, n));
  const freeAhead = Math.max(1, n - snake.length - 1);

  const collect = (minD: number, maxD: number) => {
    const pool: Point[] = [];
    for (let d = minD; d <= maxD; d += 1) {
      const cell = at[(headI + d) % n];
      if (!cell || taken.has(foodKey(cell))) continue;
      if (wouldBunch(foods, cell)) continue;
      if (existing.some((ed) => cycleGap(ed, d, n) < FOOD_AHEAD_GAP)) continue;
      pool.push(cell);
    }
    return pool;
  };

  const windows: [number, number][] = [
    [FOOD_AHEAD_MIN, FOOD_AHEAD_MAX],
    [FOOD_AHEAD_MIN, Math.min(80, freeAhead)],
    [8, freeAhead],
  ];
  for (const [minD, maxD] of windows) {
    if (maxD < minD) continue;
    const pool = collect(minD, maxD);
    if (pool.length > 0) return pool[Math.floor(Math.random() * pool.length)];
  }
  return pickEmpty(foods, cols, rows, taken);
}

export function spawnFoods(
  snake: Point[],
  foods: Food[],
  cols: number,
  rows: number,
  along?: CycleHint,
): Food[] {
  const target = Math.min(foodTarget(cols, rows, snake.length), cols * rows - snake.length);
  const taken = new Set([...snake, ...foods].map(foodKey));
  const result: Food[] = foods.map((food) => ({ ...food }));
  const guided = Boolean(along) && snake.length < RANDOM_FOOD_AT;

  while (result.length < target) {
    const pick = guided && along
      ? pickAlongCycle(snake, result, cols, rows, taken, along)
      : pickEmpty(result, cols, rows, taken);
    if (!pick) break;
    result.push({ ...pick, kind: "apple" });
    taken.add(foodKey(pick));
  }

  return result;
}

export function spawnFood(snake: Point[], cols: number, rows = cols): Food {
  return spawnFoods(snake, [], cols, rows)[0] ?? { ...snake[0], kind: "apple" };
}

type GiftDrop = {
  apples: number;
  golden: number;
  hearts: number;
  nitroMs: number;
  slowMs: number;
  glowMs: number;
  takeover: boolean;
};

function emptyCells(state: GameState) {
  const taken = new Set([...state.snake, ...state.foods].map(foodKey));
  const empty: Point[] = [];
  for (let y = 0; y < state.rows; y += 1) {
    for (let x = 0; x < state.cols; x += 1) {
      if (!taken.has(`${x},${y}`)) empty.push({ x, y });
    }
  }
  return empty;
}

function takeCells(state: GameState, count: number) {
  const pool = emptyCells(state);
  const picks: Point[] = [];
  for (let i = 0; i < count && pool.length > 0; i += 1) {
    const idx = Math.floor(Math.random() * pool.length);
    picks.push(pool.splice(idx, 1)[0]);
  }
  return picks;
}

export function applyGift(state: GameState, drop: GiftDrop, now: number, from?: string): GameState {
  if (state.status !== "playing" && state.status !== "paused" && state.status !== "idle") {
    return state;
  }
  let next: GameState = { ...state, foods: state.foods.map((food) => ({ ...food })) };
  const add = (kind: FoodKind, count: number) => {
    const cells = takeCells(next, count);
    next = {
      ...next,
      foods: [
        ...next.foods,
        ...cells.map((cell) => ({ ...cell, kind, from })),
      ],
    };
  };
  add("apple", drop.apples);
  add("golden", drop.golden);
  add("heart", drop.hearts);
  if (drop.nitroMs > 0) {
    next = {
      ...next,
      tickMs: NITRO_TICK,
      nitroUntil: Math.max(next.nitroUntil, now) + drop.nitroMs,
    };
  }
  if (drop.slowMs > 0) {
    next = {
      ...next,
      tickMs: next.nitroUntil > now ? NITRO_TICK : SLOW_TICK,
      slowUntil: Math.max(next.slowUntil, now) + drop.slowMs,
    };
  }
  if (drop.glowMs > 0) {
    next = {
      ...next,
      glowUntil: Math.max(next.glowUntil, now) + drop.glowMs,
    };
  }
  if (drop.takeover) {
    next = {
      ...next,
      hijacked: true,
      hijackStartedAt: now,
      hijackUntil: now + HIJACK_MS,
      status: next.status === "paused" ? "playing" : next.status,
    };
  }
  return { ...next, foodAt: now };
}

function clonePoints(points: Point[]): Point[] {
  return points.map((p) => ({ x: p.x, y: p.y }));
}

function lerp(a: Point, b: Point, t: number): Point {
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
  };
}

function nearlySame(a: Point, b: Point) {
  return Math.abs(a.x - b.x) < 0.02 && Math.abs(a.y - b.y) < 0.02;
}

function dedupe(points: Point[]): Point[] {
  const next: Point[] = [];
  for (const point of points) {
    const last = next[next.length - 1];
    if (!last || !nearlySame(last, point)) next.push(point);
  }
  return next;
}

function gridElbow(a: Point, b: Point): Point {
  const cornerA = { x: b.x, y: a.y };
  const cornerB = { x: a.x, y: b.y };
  const snap = (p: Point) => {
    const gx = Math.round(p.x);
    const gy = Math.round(p.y);
    return Math.abs(p.x - gx) + Math.abs(p.y - gy);
  };
  return snap(cornerA) <= snap(cornerB) ? cornerA : cornerB;
}

function insertCorners(points: Point[]): Point[] {
  if (points.length < 2) return points;
  const next: Point[] = [points[0]];

  for (let i = 1; i < points.length; i += 1) {
    const a = next[next.length - 1];
    const b = points[i];
    if (Math.abs(a.x - b.x) > 0.02 && Math.abs(a.y - b.y) > 0.02) {
      next.push(gridElbow(a, b));
    }
    next.push(b);
  }

  return next;
}
