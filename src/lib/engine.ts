import { cycleIndex, cyclePrev, generateCycleNext } from "@/lib/hamilton";

export type Point = { x: number; y: number };
export type Direction = "up" | "down" | "left" | "right";
export type GameStatus = "idle" | "playing" | "paused" | "over" | "won";
export type GridId = "compact" | "classic" | "broad";

export type GridPreset = {
  id: GridId;
  label: string;
  size: number;
  hint: string;
};

export const GRID_PRESETS: GridPreset[] = [
  { id: "compact", label: "Compact", size: 12, hint: "12 × 12" },
  { id: "classic", label: "Classic", size: 16, hint: "16 × 16" },
  { id: "broad", label: "Broad", size: 20, hint: "20 × 20" },
];

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

export const BASE_TICK = 100;
export const MIN_TICK = 55;
export const NITRO_TICK = 55;

export function foodTarget(gridSize: number) {
  return 9 + (gridSize - 12);
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

export function createGame(gridSize: number): GameState {
  const cycleNext = generateCycleNext(gridSize);
  const prev = cyclePrev(cycleNext, gridSize);
  const head = {
    x: Math.floor(Math.random() * gridSize),
    y: Math.floor(Math.random() * gridSize),
  };
  const neck = prev[head.y][head.x];
  const tail = prev[neck.y][neck.x];
  const snake: Point[] = [head, neck, tail];
  const direction = dirOf(head, cycleNext[head.y][head.x]);

  return {
    gridSize,
    snake,
    prevSnake: snake.map((p) => ({ ...p })),
    direction,
    queued: [],
    foods: spawnFoods(snake, [], gridSize),
    cycleNext,
    cycleIndex: cycleIndex(cycleNext, gridSize),
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
    nextHead.x >= state.gridSize ||
    nextHead.y >= state.gridSize
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

  const filled = snake.length >= state.gridSize * state.gridSize;
  const foods = eating
    ? spawnFoods(
        snake,
        state.foods.filter((food) => food.x !== nextHead.x || food.y !== nextHead.y),
        state.gridSize,
      )
    : state.foods;

  const tickMs = state.nitroUntil && now >= state.nitroUntil ? BASE_TICK : state.tickMs;

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
    nitroUntil: state.nitroUntil && now >= state.nitroUntil ? 0 : state.nitroUntil,
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

export function spawnFoods(snake: Point[], foods: Food[], gridSize: number): Food[] {
  const target = Math.min(foodTarget(gridSize), gridSize * gridSize - snake.length);
  const taken = new Set([...snake, ...foods].map(foodKey));
  const result: Food[] = foods.map((food) => ({ ...food }));

  while (result.length < target) {
    const spaced: Point[] = [];
    const any: Point[] = [];
    for (let y = 0; y < gridSize; y += 1) {
      for (let x = 0; x < gridSize; x += 1) {
        if (taken.has(`${x},${y}`)) continue;
        const cell = { x, y };
        any.push(cell);
        if (!wouldBunch(result, cell)) spaced.push(cell);
      }
    }
    const pool = spaced.length > 0 ? spaced : any;
    if (pool.length === 0) break;
    const pick = pool[Math.floor(Math.random() * pool.length)];
    result.push({ ...pick, kind: "apple" });
    taken.add(foodKey(pick));
  }

  return result;
}

export function spawnFood(snake: Point[], gridSize: number): Food {
  return spawnFoods(snake, [], gridSize)[0] ?? { ...snake[0], kind: "apple" };
}

type GiftDrop = {
  apples: number;
  golden: number;
  hearts: number;
  nitroMs: number;
  glowMs: number;
};

function emptyCells(state: GameState) {
  const taken = new Set([...state.snake, ...state.foods].map(foodKey));
  const empty: Point[] = [];
  for (let y = 0; y < state.gridSize; y += 1) {
    for (let x = 0; x < state.gridSize; x += 1) {
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
  if (state.status !== "playing" && state.status !== "paused") return state;
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
  if (drop.glowMs > 0) {
    next = {
      ...next,
      glowUntil: Math.max(next.glowUntil, now) + drop.glowMs,
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
