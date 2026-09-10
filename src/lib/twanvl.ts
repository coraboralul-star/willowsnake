// Port of https://github.com/twanvl/snake (MIT, Twan van Laarhoven)
// Cell tree, Dynamic Hamiltonian Cycle Repair, Perturbed Hamiltonian Cycle.

import {
  DELTA,
  OPPOSITE,
  type Direction,
  type GameState,
  type Point,
} from "@/lib/engine";

const DIRS: Direction[] = ["up", "down", "left", "right"];
const INT_MAX = 0x7fffffff;
const INVALID = -1;
const ROOT = -2;

const LEFT: Record<Direction, Direction> = {
  up: "left",
  left: "down",
  down: "right",
  right: "up",
};
const RIGHT: Record<Direction, Direction> = {
  up: "right",
  right: "down",
  down: "left",
  left: "up",
};

type View = {
  w: number;
  h: number;
  n: number;
  snake: number[];
  occ: Uint8Array;
  bombs: Set<number>;
  foods: number[];
  grow: number;
  apple: number;
  facing: Direction;
};

type Brain = {
  w: number;
  h: number;
  cycle: Int32Array;
  order: Int32Array;
  cellPath: number[];
  bombSig: string;
  turn: number;
};

let brain: Brain | null = null;
let inOpenHunt = false;

const OPEN_HUNT_LEN = 20;
const OPEN_HUNT_FREE = 0.55;

function idx(x: number, y: number, w: number) {
  return y * w + x;
}

function stepI(i: number, dir: Direction, w: number) {
  return i + DELTA[dir].x + DELTA[dir].y * w;
}

function dirBetween(from: number, to: number, w: number): Direction | null {
  const dx = (to % w) - (from % w);
  const dy = ((to / w) | 0) - ((from / w) | 0);
  if (dx === 1 && dy === 0) return "right";
  if (dx === -1 && dy === 0) return "left";
  if (dx === 0 && dy === 1) return "down";
  if (dx === 0 && dy === -1) return "up";
  return null;
}

function inBounds(i: number, dir: Direction, w: number, h: number) {
  const x = i % w;
  const y = (i / w) | 0;
  const nx = x + DELTA[dir].x;
  const ny = y + DELTA[dir].y;
  return nx >= 0 && ny >= 0 && nx < w && ny < h;
}

function manhattanI(a: number, b: number, w: number) {
  return Math.abs((a % w) - (b % w)) + Math.abs(((a / w) | 0) - ((b / w) | 0));
}

function tailOf(game: View) {
  return game.snake[game.snake.length - 1];
}

function growingInto(game: View, cell: number) {
  return game.grow > 0 || game.foods.includes(cell);
}

function blocked(game: View, cell: number, grow = growingInto(game, cell)) {
  if (cell < 0 || cell >= game.n) return true;
  if (game.bombs.has(cell)) return true;
  if (!game.occ[cell]) return false;
  if (!grow && cell === tailOf(game)) return false;
  return true;
}

function cloneView(game: View): View {
  return {
    w: game.w,
    h: game.h,
    n: game.n,
    snake: game.snake.slice(),
    occ: game.occ.slice(),
    bombs: new Set(game.bombs),
    foods: game.foods.slice(),
    grow: game.grow,
    apple: game.apple,
    facing: game.facing,
  };
}

function toView(state: GameState, apple?: number): View {
  const w = state.cols;
  const h = state.rows;
  const n = w * h;
  const snake = state.snake.map((p) => idx(p.x, p.y, w));
  const occ = new Uint8Array(n);
  for (const cell of snake) occ[cell] = 1;
  const foods = state.foods.map((food) => idx(food.x, food.y, w));
  const bombs = new Set(state.bombs.map((bomb) => idx(bomb.x, bomb.y, w)));
  for (const cell of bombs) occ[cell] = 1;
  return {
    w,
    h,
    n,
    snake,
    occ,
    bombs,
    foods,
    grow: state.pendingGrow,
    apple: apple ?? foods[0] ?? INVALID,
    facing: state.queued.at(-1) ?? state.direction,
  };
}

function isLegal(game: View, dir: Direction) {
  if (dir === OPPOSITE[game.facing]) return false;
  if (!inBounds(game.snake[0], dir, game.w, game.h)) return false;
  return !blocked(game, stepI(game.snake[0], dir, game.w));
}

function anyLegal(game: View): Direction | null {
  for (const dir of DIRS) if (isLegal(game, dir)) return dir;
  return null;
}

class MinHeap {
  keys: number[] = [];
  vals: number[] = [];

  get size() {
    return this.keys.length;
  }

  push(key: number, val: number) {
    this.keys.push(key);
    this.vals.push(val);
    this.up(this.keys.length - 1);
  }

  pop() {
    const { keys, vals } = this;
    const top = vals[0];
    const lastK = keys.pop();
    const lastV = vals.pop();
    if (keys.length > 0 && lastK != null && lastV != null) {
      keys[0] = lastK;
      vals[0] = lastV;
      this.down(0);
    }
    return top;
  }

  private up(i: number) {
    const { keys, vals } = this;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (keys[p] <= keys[i]) break;
      [keys[p], keys[i]] = [keys[i], keys[p]];
      [vals[p], vals[i]] = [vals[i], vals[p]];
      i = p;
    }
  }

  private down(i: number) {
    const { keys, vals } = this;
    for (;;) {
      let m = i;
      const l = i * 2 + 1;
      const r = l + 1;
      if (l < keys.length && keys[l] < keys[m]) m = l;
      if (r < keys.length && keys[r] < keys[m]) m = r;
      if (m === i) break;
      [keys[m], keys[i]] = [keys[i], keys[m]];
      [vals[m], vals[i]] = [vals[i], vals[m]];
      i = m;
    }
  }
}

type Steps = { dist: Int32Array; from: Int32Array };

function astar(
  n: number,
  w: number,
  h: number,
  edge: (from: number, to: number, dir: Direction) => number,
  from: number,
  to: number,
  minCost: number,
): Steps {
  const dist = new Int32Array(n).fill(INT_MAX);
  const came = new Int32Array(n).fill(INVALID);
  const bound = (c: number) => minCost * manhattanI(c, to, w);
  const heap = new MinHeap();
  dist[from] = 0;
  heap.push(bound(from), from);
  while (heap.size) {
    const cur = heap.pop();
    if (cur === to) break;
    for (const dir of DIRS) {
      if (!inBounds(cur, dir, w, h)) continue;
      const next = stepI(cur, dir, w);
      const cost = edge(cur, next, dir);
      if (cost === INT_MAX) continue;
      const nextDist = dist[cur] + cost;
      if (nextDist < dist[next]) {
        dist[next] = nextDist;
        came[next] = cur;
        heap.push(nextDist + bound(next), next);
      }
    }
  }
  return { dist, from: came };
}

function readPath(steps: Steps, from: number, to: number) {
  const path: number[] = [];
  let cur = to;
  while (cur !== ROOT && cur !== from) {
    path.push(cur);
    if (cur === INVALID) break;
    cur = steps.from[cur];
  }
  return path;
}

function firstStep(steps: Steps, from: number, to: number) {
  let cur = to;
  while (cur !== ROOT && steps.from[cur] !== from) {
    if (cur === INVALID) break;
    cur = steps.from[cur];
  }
  return cur;
}

function flood(
  n: number,
  w: number,
  h: number,
  start: number,
  canMove: (from: number, to: number, dir: Direction) => boolean,
) {
  const seen = new Uint8Array(n);
  const q = [start];
  seen[start] = 1;
  for (let i = 0; i < q.length; i += 1) {
    const cur = q[i];
    for (const dir of DIRS) {
      if (!inBounds(cur, dir, w, h)) continue;
      const next = stepI(cur, dir, w);
      if (seen[next] || !canMove(cur, next, dir)) continue;
      seen[next] = 1;
      q.push(next);
    }
  }
  return seen;
}

function afterMoves(game: View, path: number[], moveTail: boolean) {
  const after = cloneView(game);
  for (let i = path.length - 1; i >= 0; i -= 1) {
    const cell = path[i];
    if (cell < 0 || cell >= after.n) continue;
    const eat = cell === game.apple || after.foods.includes(cell);
    after.snake.unshift(cell);
    after.occ[cell] = 1;
    if (eat) {
      after.foods = after.foods.filter((food) => food !== cell);
    } else if (moveTail && after.grow <= 0) {
      const tail = after.snake.pop();
      if (tail != null) after.occ[tail] = 0;
    } else if (after.grow > 0) {
      after.grow -= 1;
    }
  }
  return after;
}

function cellMoveInside(x: number, y: number): Direction {
  if ((y & 1) === 0) return (x & 1) === 0 ? "down" : "left";
  return (x & 1) === 0 ? "right" : "up";
}

function cellMoveOutside(x: number, y: number): Direction {
  if ((y & 1) === 0) return (x & 1) === 0 ? "left" : "up";
  return (x & 1) === 0 ? "down" : "right";
}

function isCellMove(x: number, y: number, dir: Direction) {
  return cellMoveInside(x, y) === dir || cellMoveOutside(x, y) === dir;
}

function cellTreeParents(game: View) {
  const cw = game.w >> 1;
  const parents = new Int32Array(cw * (game.h >> 1)).fill(INVALID);
  let parent = ROOT;
  for (let i = game.snake.length - 1; i >= 0; i -= 1) {
    const cell = game.snake[i];
    const cx = (cell % game.w) >> 1;
    const cy = ((cell / game.w) | 0) >> 1;
    const id = cy * cw + cx;
    if (parents[id] === INVALID) parents[id] = parent;
    parent = id;
  }
  return parents;
}

function canMoveInCellTree(
  parents: Int32Array,
  w: number,
  from: number,
  to: number,
  dir: Direction,
) {
  const ax = from % w;
  const ay = (from / w) | 0;
  if (!isCellMove(ax, ay, dir)) return false;
  const cw = w >> 1;
  const ca = (ay >> 1) * cw + (ax >> 1);
  const cb = (((to / w) | 0) >> 1) * cw + ((to % w) >> 1);
  return cb === ca || parents[cb] === INVALID || parents[ca] === cb;
}

function cellTreeUnreachables(game: View, dists: Int32Array) {
  const parents = cellTreeParents(game);
  const canMove = (from: number, to: number, dir: Direction) =>
    canMoveInCellTree(parents, game.w, from, to, dir) && !game.occ[to];
  const reachable = flood(game.n, game.w, game.h, game.snake[0], canMove);
  let any = false;
  let nearest = INVALID;
  let nearestDist = INT_MAX;
  for (let i = 0; i < game.n; i += 1) {
    if (game.occ[i]) {
      reachable[i] = 1;
      continue;
    }
    if (reachable[i]) continue;
    any = true;
    if (dists[i] < nearestDist) {
      nearest = i;
      nearestDist = dists[i];
    }
  }
  return { any, nearest, nearestDist };
}

function clampPick(a: number, b: number, prefer: number, lo: number, hi: number) {
  const options = [a, b].filter((v) => v >= lo && v < hi);
  if (!options.length) return prefer;
  return options.reduce((best, v) =>
    Math.abs(v - prefer) < Math.abs(best - prefer) ? v : best,
  );
}

function horizRailY(appleY: number, toward: "left" | "right", hy: number, h: number) {
  if (toward === "right") {
    if ((appleY & 1) === 1) return appleY;
    return clampPick(appleY - 1, appleY + 1, hy, 0, h);
  }
  if ((appleY & 1) === 0) return appleY;
  return clampPick(appleY - 1, appleY + 1, hy, 0, h);
}

function vertRailX(appleX: number, toward: "up" | "down", hx: number, w: number) {
  if (toward === "down") {
    if ((appleX & 1) === 0) return appleX;
    return clampPick(appleX - 1, appleX + 1, hx, 0, w);
  }
  if ((appleX & 1) === 1) return appleX;
  return clampPick(appleX - 1, appleX + 1, hx, 0, w);
}

function railAlign(game: View, from: number, dir: Direction) {
  if (game.apple < 0) return 0;
  const fx = from % game.w;
  const fy = (from / game.w) | 0;
  const ax = game.apple % game.w;
  const ay = (game.apple / game.w) | 0;
  const to = stepI(from, dir, game.w);
  if (to === game.apple) return -400;
  const dx = ax - fx;
  const dy = ay - fy;
  const horizToward: "left" | "right" = dx >= 0 ? "right" : "left";
  const vertToward: "up" | "down" = dy >= 0 ? "down" : "up";
  const railY = horizRailY(ay, horizToward, fy, game.h);
  const railX = vertRailX(ax, vertToward, fx, game.w);
  const horizLead =
    Math.abs(dx) > Math.abs(dy) ||
    (Math.abs(dx) === Math.abs(dy) && (fy === railY || dir === horizToward));
  if (horizLead && dx !== 0) {
    const onRail = fy === railY;
    if (onRail && dir === horizToward) return -260;
    if (dir === OPPOSITE[horizToward]) return 280;
    if (onRail && (dir === "up" || dir === "down")) return 180;
    const closer = Math.abs((fy + DELTA[dir].y) - railY) < Math.abs(fy - railY);
    if (!onRail && closer) return -140;
    if (!onRail && dir === horizToward) return -40;
    return 0;
  }
  if (dy !== 0) {
    const onRail = fx === railX;
    if (onRail && dir === vertToward) return -260;
    if (dir === OPPOSITE[vertToward]) return 280;
    if (onRail && (dir === "left" || dir === "right")) return 180;
    const closer = Math.abs((fx + DELTA[dir].x) - railX) < Math.abs(fx - railX);
    if (!onRail && closer) return -140;
    if (!onRail && dir === vertToward) return -40;
    return 0;
  }
  return 0;
}

function cellEdge(
  game: View,
  parents: Int32Array,
  from: number,
  to: number,
  dir: Direction,
) {
  if (!canMoveInCellTree(parents, game.w, from, to, dir) || blocked(game, to, true)) {
    return INT_MAX;
  }
  if (game.occ[to] && to !== tailOf(game)) return INT_MAX;
  const cw = game.w >> 1;
  const ca = (((from / game.w) | 0) >> 1) * cw + ((from % game.w) >> 1);
  const cb = (((to / game.w) | 0) >> 1) * cw + ((to % game.w) >> 1);
  const toParent = cb === parents[ca];
  const toSame = cb === ca;
  const appleCell =
    game.apple >= 0
      ? ((((game.apple / game.w) | 0) >> 1) * cw + ((game.apple % game.w) >> 1))
      : INVALID;
  const progress =
    game.apple >= 0 ? manhattanI(to, game.apple, game.w) - manhattanI(from, game.apple, game.w) : 0;
  const closer = progress < 0;
  const continueDir =
    dir === OPPOSITE[game.facing] ? 220 : dir === game.facing ? (closer ? -40 : 25) : closer ? -10 : 30;
  let lane = 0;
  if (!toSame && game.apple >= 0) {
    const acx = (game.apple % game.w) >> 1;
    const acy = ((game.apple / game.w) | 0) >> 1;
    const distBefore = Math.abs((ca % cw) - acx) + Math.abs(((ca / cw) | 0) - acy);
    const distAfter = Math.abs((cb % cw) - acx) + Math.abs(((cb / cw) | 0) - acy);
    lane = distAfter < distBefore ? -80 : distAfter > distBefore ? 120 : 20;
  }
  const right = RIGHT[dir];
  let hug = 0;
  if (inBounds(to, right, game.w, game.h)) {
    const side = stepI(to, right, game.w);
    if (game.occ[side]) hug = -30;
  } else {
    hug = -30;
  }
  // Hairpins loop the same 2x2 without getting closer. Stairs reduce manhattan.
  const hairpin = toSame && progress >= 0 && cb !== appleCell && to !== game.apple;
  const penalty = toParent ? 160 : hairpin ? 240 : toSame ? 20 : lane;
  return 1000 + penalty + continueDir + hug + railAlign(game, from, dir) + progress * 70;
}

function cellTreeMove(game: View): Direction | null {
  if ((game.w & 1) !== 0 || (game.h & 1) !== 0) return null;
  if (game.apple < 0) return null;
  const pos = game.snake[0];
  const parents = cellTreeParents(game);
  const edge = (from: number, to: number, dir: Direction) =>
    cellEdge(game, parents, from, to, dir);
  const steps = astar(game.n, game.w, game.h, edge, pos, game.apple, 400);
  let path = readPath(steps, pos, game.apple);
  let next = path[path.length - 1] ?? INVALID;

  if (next === INVALID) {
    if (brain && brain.cellPath.length) next = brain.cellPath[brain.cellPath.length - 1];
    else if (path.length > 1) {
      path = path.slice(0, -1);
      next = path[path.length - 1] ?? INVALID;
    }
  }

  if (next !== INVALID && path.length > 0 && path[path.length - 1] !== INVALID) {
    const after = afterMoves(game, path, true);
    const unreachable = cellTreeUnreachables(after, steps.dist);
    if (unreachable.any) {
      if (unreachable.nearestDist < INT_MAX) {
        const detour = firstStep(steps, pos, unreachable.nearest);
        if (detour >= 0) {
          const dir = dirBetween(pos, detour, game.w);
          if (dir && isLegal(game, dir)) {
            if (brain) brain.cellPath = [];
            return dir;
          }
        }
      }
      if (brain && brain.cellPath.length) {
        const cached = brain.cellPath.pop();
        if (cached != null) {
          const dir = dirBetween(pos, cached, game.w);
          if (dir && isLegal(game, dir)) return dir;
        }
      }
      for (const dir of DIRS) {
        const cell = inBounds(pos, dir, game.w, game.h) ? stepI(pos, dir, game.w) : -1;
        if (cell < 0 || cell === next) continue;
        if (edge(pos, cell, dir) !== INT_MAX && isLegal(game, dir)) {
          if (brain) brain.cellPath = [];
          return dir;
        }
      }
    }
  }

  if (next === INVALID || next === pos) return null;
  const dir = dirBetween(pos, next, game.w);
  if (!dir || !isLegal(game, dir)) return null;
  if (brain) {
    brain.cellPath = path.filter((cell) => cell >= 0 && cell !== next);
  }
  return dir;
}

function zigZagDir(x: number, y: number, w: number, h: number): Direction {
  if (y === 0 && x > 0) return "left";
  if ((x & 1) === 0) return y === h - 1 ? "right" : "down";
  if (y === 1 && x !== w - 1) return "right";
  return "up";
}

function makeZigZag(w: number, h: number) {
  const cycle = new Int32Array(w * h);
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const dir = zigZagDir(x, y, w, h);
      cycle[idx(x, y, w)] = idx(x + DELTA[dir].x, y + DELTA[dir].y, w);
    }
  }
  return cycle;
}

function cycleFromNext(next: Point[][], w: number, h: number) {
  const cycle = new Int32Array(w * h);
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const p = next[y]?.[x];
      if (!p) return null;
      cycle[idx(x, y, w)] = idx(p.x, p.y, w);
    }
  }
  return isHamiltonian(cycle, w, h) ? cycle : null;
}

function isHamiltonian(cycle: Int32Array, w: number, h: number) {
  const n = w * h;
  if (cycle.length !== n) return false;
  const seen = new Uint8Array(n);
  let cur = 0;
  for (let i = 0; i < n; i += 1) {
    const next = cycle[cur];
    if (next < 0 || next >= n || seen[next]) return false;
    if (manhattanI(cur, next, w) !== 1) return false;
    seen[next] = 1;
    cur = next;
  }
  return cur === 0;
}

function fillOrder(cycle: Int32Array, order: Int32Array) {
  order.fill(-1);
  let cur = 0;
  for (let i = 0; i < cycle.length; i += 1) {
    order[cur] = i;
    cur = cycle[cur];
  }
}

function cycleDistance(order: Int32Array, n: number, a: number, b: number) {
  const oa = order[a];
  const ob = order[b];
  return oa < ob ? ob - oa : ob - oa + n;
}

function pathFrom(cycle: Int32Array, w: number, h: number, to: number) {
  for (const dir of DIRS) {
    if (!inBounds(to, dir, w, h)) continue;
    const from = stepI(to, dir, w);
    if (cycle[from] === to) return from;
  }
  return INVALID;
}

function cycleDistancesTo(cycle: Int32Array, goal: number) {
  const dists = new Int32Array(cycle.length);
  let cur = goal;
  let dist = cycle.length - 1;
  do {
    cur = cycle[cur];
    dists[cur] = dist;
    dist -= 1;
  } while (cur !== goal);
  return dists;
}

function snakeOccupied(game: View, cell: number) {
  return game.occ[cell] === 1 && (game.grow > 0 || cell !== tailOf(game));
}

function repairCycle(game: View, cycle: Int32Array, a: number, d: number) {
  if (cycle[a] === d) return true;
  if (manhattanI(a, d, game.w) !== 1) return false;
  const b = cycle[a];
  const c = pathFrom(cycle, game.w, game.h, d);
  if (c < 0 || manhattanI(b, c, game.w) !== 1) return false;

  const onKeep = new Uint8Array(game.n);
  for (let x = d; x !== a; x = cycle[x]) onKeep[x] = 1;
  onKeep[a] = 1;

  for (let x = b; x !== c; x = cycle[x]) {
    const y = cycle[x];
    const xy = dirBetween(x, y, game.w);
    if (!xy) continue;
    for (const turn of [RIGHT[xy], LEFT[xy]]) {
      if (!inBounds(y, turn, game.w, game.h) || !inBounds(x, turn, game.w, game.h)) {
        continue;
      }
      const u = stepI(y, turn, game.w);
      const v = stepI(x, turn, game.w);
      if (!onKeep[u] || !onKeep[v] || cycle[u] !== v) continue;
      if (snakeOccupied(game, u) || snakeOccupied(game, v)) continue;
      cycle[a] = d;
      cycle[c] = b;
      cycle[x] = v;
      cycle[u] = y;
      return true;
    }
  }
  return false;
}

function dhcrMove(game: View, cycle: Int32Array): Direction | null {
  if (game.apple < 0) return followCycle(game, cycle);
  const pos = game.snake[0];
  const dists = cycleDistancesTo(cycle, game.apple);
  const edge = (from: number, to: number, _dir: Direction) => {
    if (snakeOccupied(game, to) && to !== game.apple) return INT_MAX;
    return 1_000_000 + dists[to];
  };
  const steps = astar(game.n, game.w, game.h, edge, pos, game.apple, 1_000_000);
  const path = readPath(steps, pos, game.apple);
  let target = path[path.length - 1] ?? INVALID;
  if (target < 0 || manhattanI(pos, target, game.w) !== 1) {
    return followCycle(game, cycle);
  }
  repairCycle(game, cycle, pos, target);
  return followCycle(game, cycle);
}

function followCycle(game: View, cycle: Int32Array): Direction | null {
  const next = cycle[game.snake[0]];
  const dir = dirBetween(game.snake[0], next, game.w);
  if (dir && isLegal(game, dir)) return dir;
  return null;
}

function phcMove(game: View, cycle: Int32Array, order: Int32Array): Direction | null {
  if (game.apple < 0) return followCycle(game, cycle);
  const pos = game.snake[0];
  const tail = tailOf(game);
  const distGoal = cycleDistance(order, game.n, pos, game.apple);
  const distTail = cycleDistance(order, game.n, pos, tail);
  let maxShortcut = Math.min(distGoal, distTail - 3);
  if (game.snake.length > (game.n * 50) / 100) maxShortcut = 0;
  if (distGoal < distTail) {
    maxShortcut -= 1;
    if ((distTail - distGoal) * 4 > game.n - game.snake.length) maxShortcut -= 10;
  }
  let next = cycle[pos];
  let distNext = 1;
  if (maxShortcut > 0) {
    for (const dir of DIRS) {
      if (!inBounds(pos, dir, game.w, game.h)) continue;
      const b = stepI(pos, dir, game.w);
      if (blocked(game, b)) continue;
      const distB = cycleDistance(order, game.n, pos, b);
      if (distB <= maxShortcut && distB > distNext) {
        next = b;
        distNext = distB;
      }
    }
  }
  const dir = dirBetween(pos, next, game.w);
  return dir && isLegal(game, dir) ? dir : followCycle(game, cycle);
}

function pickApple(game: View) {
  const head = game.snake[0];
  let best = INVALID;
  let bestDist = INT_MAX;
  for (const food of game.foods) {
    const d = manhattanI(head, food, game.w);
    if (d < bestDist) {
      best = food;
      bestDist = d;
    }
  }
  game.apple = best;
}

function ensureBrain(state: GameState): Brain {
  const w = state.cols;
  const h = state.rows;
  if (brain && brain.w === w && brain.h === h) return brain;
  const fromState = cycleFromNext(state.cycleNext, w, h);
  const cycle = fromState ?? makeZigZag(w, h);
  const order = new Int32Array(w * h);
  fillOrder(cycle, order);
  brain = { w, h, cycle, order, cellPath: [], bombSig: "", turn: 0 };
  return brain;
}

export function resetTwanvlBrain() {
  brain = null;
  inOpenHunt = false;
}

function expandOrder(facing: Direction): Direction[] {
  return [facing, LEFT[facing], RIGHT[facing], OPPOSITE[facing]];
}

function isOpenHunt(state: GameState) {
  const n = state.cols * state.rows;
  const free = n - state.snake.length - state.bombs.length;
  return state.snake.length < OPEN_HUNT_LEN && free > n * OPEN_HUNT_FREE;
}

function firstStepDir(came: Int32Array, from: number, to: number, w: number): Direction | null {
  let cur = to;
  let prev = came[cur];
  while (prev !== ROOT && prev !== from) {
    if (cur === INVALID || prev === INVALID) return null;
    cur = prev;
    prev = came[cur];
  }
  if (prev !== from) return null;
  return dirBetween(from, cur, w);
}

function bfsToFood(game: View, goal: number): Direction | null {
  const head = game.snake[0];
  if (head === goal) return null;
  const came = new Int32Array(game.n).fill(INVALID);
  const q = [head];
  came[head] = ROOT;
  for (let i = 0; i < q.length; i += 1) {
    const cur = q[i];
    const facing = cur === head ? game.facing : (dirBetween(came[cur], cur, game.w) ?? game.facing);
    for (const dir of expandOrder(facing)) {
      if (!inBounds(cur, dir, game.w, game.h)) continue;
      const next = stepI(cur, dir, game.w);
      if (came[next] !== INVALID) continue;
      if (next !== goal && blocked(game, next)) continue;
      if (next === goal && game.bombs.has(next)) continue;
      came[next] = cur;
      if (next === goal) {
        const step = firstStepDir(came, head, goal, game.w);
        return step && isLegal(game, step) ? step : null;
      }
      q.push(next);
    }
  }
  return null;
}

function pickOpenHuntDir(state: GameState): Direction {
  const game = toView(state);
  const foods = game.foods
    .slice()
    .sort((a, b) => manhattanI(game.snake[0], a, game.w) - manhattanI(game.snake[0], b, game.w));
  for (const food of foods) {
    const dir = bfsToFood(game, food);
    if (dir) return dir;
  }
  return preferSafe(state, game, anyLegal(game) ?? game.facing);
}

function pickCellHuntDir(state: GameState): Direction {
  const game = toView(state);
  const active = ensureBrain(state);
  const sig = bombSig(state);
  if (active.bombSig !== sig) {
    active.cellPath = [];
    active.bombSig = sig;
  }
  active.turn += 1;
  pickApple(game);

  let picked: Direction | null = null;
  if (game.apple >= 0) {
    picked = tryCellHunt(game, active.cycle, active.order);
    if (!picked) {
      const dhcr = dhcrMove(game, active.cycle);
      fillOrder(active.cycle, active.order);
      if (dhcr && isLegal(game, dhcr)) picked = dhcr;
    }
    if (!picked) {
      const phc = phcMove(game, active.cycle, active.order);
      if (phc && isLegal(game, phc)) picked = phc;
    }
  }

  picked ??= followCycle(game, active.cycle) ?? takeBombIfTrapped(state, game) ?? anyLegal(game);
  return preferSafe(state, game, picked ?? game.facing);
}

function tryCellHunt(game: View, cycle: Int32Array, order: Int32Array) {
  const foods = game.foods
    .slice()
    .sort((a, b) => manhattanI(game.snake[0], a, game.w) - manhattanI(game.snake[0], b, game.w));
  for (const food of foods) {
    game.apple = food;
    const cellDir = cellTreeMove(game);
    if (cellDir && isLegal(game, cellDir)) {
      const target = stepI(game.snake[0], cellDir, game.w);
      if (repairCycle(game, cycle, game.snake[0], target)) fillOrder(cycle, order);
      return cellDir;
    }
  }
  return null;
}

function takeBombIfTrapped(state: GameState, game: View): Direction | null {
  if (game.bombs.size === 0) return null;
  if (DIRS.some((dir) => isLegal(game, dir))) return null;
  for (const dir of DIRS) {
    if (dir === OPPOSITE[game.facing]) continue;
    if (!inBounds(game.snake[0], dir, game.w, game.h)) continue;
    const cell = stepI(game.snake[0], dir, game.w);
    if (!game.bombs.has(cell)) continue;
    if (game.snake.includes(cell) && cell !== tailOf(game)) continue;
    return dir;
  }
  return null;
}

function intoBomb(game: View, dir: Direction) {
  if (!inBounds(game.snake[0], dir, game.w, game.h)) return false;
  return game.bombs.has(stepI(game.snake[0], dir, game.w));
}

function preferSafe(state: GameState, game: View, dir: Direction): Direction {
  const safe = DIRS.filter((next) => isLegal(game, next));
  if (safe.length === 0) return takeBombIfTrapped(state, game) ?? dir;
  if (!intoBomb(game, dir) && isLegal(game, dir)) return dir;
  if (isLegal(game, game.facing)) return game.facing;
  const left = LEFT[game.facing];
  const right = RIGHT[game.facing];
  if (isLegal(game, left)) return left;
  if (isLegal(game, right)) return right;
  return safe[0];
}

function bombSig(state: GameState) {
  if (state.bombs.length === 0) return "";
  return state.bombs
    .map((bomb) => `${bomb.x},${bomb.y}`)
    .sort()
    .join(";");
}

export function pickTwanvlDir(state: GameState): Direction {
  if (isOpenHunt(state)) {
    inOpenHunt = true;
    return pickOpenHuntDir(state);
  }
  if (inOpenHunt) {
    resetTwanvlBrain();
  }
  return pickCellHuntDir(state);
}
