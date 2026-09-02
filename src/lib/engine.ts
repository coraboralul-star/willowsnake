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

export type GameState = {
  gridSize: number;
  snake: Point[];
  prevSnake: Point[];
  direction: Direction;
  queued: Direction[];
  food: Point;
  score: number;
  status: GameStatus;
  tickStartedAt: number;
  tickMs: number;
  pauseT: number;
  ateAt: number;
  foodAt: number;
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

export const BASE_TICK = 120;
export const MIN_TICK = 120;

export function createGame(gridSize: number): GameState {
  const mid = Math.floor(gridSize / 2);
  const snake: Point[] = [
    { x: mid, y: mid },
    { x: mid - 1, y: mid },
    { x: mid - 2, y: mid },
  ];

  return {
    gridSize,
    snake,
    prevSnake: snake.map((p) => ({ ...p })),
    direction: "right",
    queued: [],
    food: spawnFood(snake, gridSize),
    score: 0,
    status: "idle",
    tickStartedAt: 0,
    tickMs: BASE_TICK,
    pauseT: 1,
    ateAt: 0,
    foodAt: 0,
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

  const eating = nextHead.x === state.food.x && nextHead.y === state.food.y;
  const body = eating ? state.snake : state.snake.slice(0, -1);
  if (body.some((p) => p.x === nextHead.x && p.y === nextHead.y)) {
    return { ...state, status: "over", prevSnake: clonePoints(state.snake), queued };
  }

  const snake = [nextHead, ...state.snake];
  if (!eating) snake.pop();

  const filled = snake.length >= state.gridSize * state.gridSize;

  return {
    ...state,
    prevSnake: clonePoints(state.snake),
    snake,
    direction,
    queued,
    food: eating ? spawnFood(snake, state.gridSize) : state.food,
    score: eating ? state.score + 1 : state.score,
    tickMs: state.tickMs,
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

export function spawnFood(snake: Point[], gridSize: number): Point {
  const taken = new Set(snake.map((p) => `${p.x},${p.y}`));
  const empty: Point[] = [];

  for (let y = 0; y < gridSize; y += 1) {
    for (let x = 0; x < gridSize; x += 1) {
      if (!taken.has(`${x},${y}`)) empty.push({ x, y });
    }
  }

  if (empty.length === 0) return snake[0];
  return empty[Math.floor(Math.random() * empty.length)];
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
