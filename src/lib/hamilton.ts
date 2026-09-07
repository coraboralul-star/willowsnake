type Point = { x: number; y: number };

type Room = { x: number; y: number; w: number; h: number };

type FoldStyle = "keep" | "fold" | "combX" | "combY";

function eq(a: Point, b: Point) {
  return a.x === b.x && a.y === b.y;
}

function manhattan(a: Point, b: Point) {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

function nextI(i: number, len: number) {
  return (i + 1) % len;
}

function pick<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

function shuffle<T>(items: T[]): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = out[i];
    out[i] = out[j];
    out[j] = tmp;
  }
  return out;
}

function offset(order: Point[], ox: number, oy: number): Point[] {
  return order.map((p) => ({ x: p.x + ox, y: p.y + oy }));
}

function indexOf(order: Point[], n: number) {
  const index = Array.from({ length: n }, () => Array<number>(n).fill(-1));
  for (let i = 0; i < order.length; i += 1) {
    const p = order[i];
    index[p.y][p.x] = i;
  }
  return index;
}

function toNext(order: Point[], n: number) {
  const next = Array.from({ length: n }, () => Array<Point>(n));
  for (let i = 0; i < order.length; i += 1) {
    const a = order[i];
    next[a.y][a.x] = order[nextI(i, order.length)];
  }
  return next;
}

function toPrev(order: Point[], n: number) {
  const prev = Array.from({ length: n }, () => Array<Point>(n));
  for (let i = 0; i < order.length; i += 1) {
    const a = order[i];
    const b = order[nextI(i, order.length)];
    prev[b.y][b.x] = a;
  }
  return prev;
}

function isSimpleCycle(order: Point[]) {
  if (order.length < 4) return false;
  const seen = new Set<string>();
  for (let i = 0; i < order.length; i += 1) {
    const a = order[i];
    const b = order[nextI(i, order.length)];
    if (manhattan(a, b) !== 1) return false;
    const id = `${a.x},${a.y}`;
    if (seen.has(id)) return false;
    seen.add(id);
  }
  return seen.size === order.length;
}

function serpentine(w: number, h: number): Point[] {
  const order: Point[] = [];
  let x = 0;
  let y = 0;
  for (let i = 0; i < w * h; i += 1) {
    order.push({ x, y });
    const nxt = serpNext(x, y, w, h);
    x = nxt.x;
    y = nxt.y;
  }
  return order;
}

function serpNext(x: number, y: number, w: number, h: number): Point {
  if (y === 0) {
    if (x === 0) return { x: 0, y: 1 };
    return { x: x - 1, y: 0 };
  }
  if (x % 2 === 0) {
    if (y === h - 1) return { x: x + 1, y };
    return { x, y: y + 1 };
  }
  if (y === 1) {
    if (x === w - 1) return { x, y: 0 };
    return { x: x + 1, y };
  }
  return { x, y: y - 1 };
}

function rowSerpentine(w: number, h: number): Point[] {
  return serpentine(h, w).map((p) => ({ x: p.y, y: p.x }));
}

function rectRing(w: number, h: number, k: number): Point[] {
  const x0 = k;
  const y0 = k;
  const x1 = w - 1 - k;
  const y1 = h - 1 - k;
  if (x1 === x0 + 1) {
    const pts: Point[] = [];
    for (let y = y0; y <= y1; y += 1) pts.push({ x: x0, y });
    for (let y = y1; y >= y0; y -= 1) pts.push({ x: x1, y });
    return pts;
  }
  if (y1 === y0 + 1) {
    const pts: Point[] = [];
    for (let x = x0; x <= x1; x += 1) pts.push({ x, y: y0 });
    for (let x = x1; x >= x0; x -= 1) pts.push({ x, y: y1 });
    return pts;
  }
  const pts: Point[] = [];
  for (let x = x0; x < x1; x += 1) pts.push({ x, y: y0 });
  for (let y = y0; y < y1; y += 1) pts.push({ x: x1, y });
  for (let x = x1; x > x0; x -= 1) pts.push({ x, y: y1 });
  for (let y = y1; y > y0; y -= 1) pts.push({ x: x0, y });
  return pts;
}

function spliceCycles(
  a: Point[],
  b: Point[],
  n: number,
  p: Point,
  p2: Point,
  q: Point,
  endB: Point,
  walkB: "prev" | "next",
) {
  const nextA = toNext(a, n);
  const stepB = walkB === "prev" ? toPrev(b, n) : toNext(b, n);
  const out: Point[] = [p];
  let cur = q;
  for (let k = 0; k < b.length; k += 1) {
    out.push(cur);
    if (eq(cur, endB)) break;
    const nxt = stepB[cur.y]?.[cur.x];
    if (!nxt) return null;
    cur = nxt;
  }
  cur = p2;
  let guard = 0;
  while (!eq(cur, p) && guard < a.length + 2) {
    out.push(cur);
    cur = nextA[cur.y][cur.x];
    guard += 1;
  }
  if (!isSimpleCycle(out) || out.length !== a.length + b.length) return null;
  return out;
}

function mergeCycles(a: Point[], b: Point[], n: number): Point[] | null {
  const nextB = toNext(b, n);
  const prevB = toPrev(b, n);
  const idxB = indexOf(b, n);
  const spots: {
    p: Point;
    p2: Point;
    q: Point;
    endB: Point;
    walkB: "prev" | "next";
  }[] = [];

  for (let i = 0; i < a.length; i += 1) {
    const p = a[i];
    const p2 = a[nextI(i, a.length)];
    const neighbors: Point[] = [
      { x: p.x + 1, y: p.y },
      { x: p.x - 1, y: p.y },
      { x: p.x, y: p.y + 1 },
      { x: p.x, y: p.y - 1 },
    ];
    for (const q of neighbors) {
      if (q.x < 0 || q.y < 0 || q.x >= n || q.y >= n) continue;
      if (idxB[q.y][q.x] < 0) continue;
      const qNext = nextB[q.y][q.x];
      const qPrev = prevB[q.y][q.x];
      if (manhattan(p2, qNext) === 1 && !eq(p2, q) && !eq(p, qNext)) {
        spots.push({ p, p2, q, endB: qNext, walkB: "prev" });
      }
      if (manhattan(p2, qPrev) === 1 && !eq(p2, q) && !eq(p, qPrev)) {
        spots.push({ p, p2, q, endB: qPrev, walkB: "next" });
      }
    }
  }

  if (spots.length === 0) return null;
  for (const spot of shuffle(spots)) {
    const merged = spliceCycles(a, b, n, spot.p, spot.p2, spot.q, spot.endB, spot.walkB);
    if (merged) return merged;
  }
  return null;
}

function joinAll(parts: Point[][], n: number): Point[] | null {
  if (parts.length === 0) return null;
  let acc = parts[0];
  const rest = parts.slice(1);
  while (rest.length) {
    let found = -1;
    let merged: Point[] | null = null;
    for (let i = 0; i < rest.length; i += 1) {
      merged = mergeCycles(acc, rest[i], n) ?? mergeCycles(rest[i], acc, n);
      if (merged) {
        found = i;
        break;
      }
    }
    if (found < 0 || !merged) return null;
    acc = merged;
    rest.splice(found, 1);
  }
  return acc;
}

function nestedRings(w: number, h: number): Point[] {
  const layers = Math.min(Math.floor(w / 2), Math.floor(h / 2));
  let cycle = rectRing(w, h, 0);
  for (let k = 1; k < layers; k += 1) {
    const inner = rectRing(w, h, k);
    const merged = mergeCycles(cycle, inner, Math.max(w, h));
    if (!merged) {
      return Math.random() < 0.5 ? serpentine(w, h) : rowSerpentine(w, h);
    }
    cycle = merged;
  }
  return cycle;
}

function twoByTwo(flip = false): Point[] {
  const pts = [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 1, y: 1 },
    { x: 0, y: 1 },
  ];
  return flip ? [pts[0], pts[3], pts[2], pts[1]] : pts;
}

function stripCycle(w: number, h: number): Point[] {
  const pts: Point[] = [];
  if (h === 2) {
    for (let x = 0; x < w; x += 1) pts.push({ x, y: 0 });
    for (let x = w - 1; x >= 0; x -= 1) pts.push({ x, y: 1 });
    return pts;
  }
  for (let y = 0; y < h; y += 1) pts.push({ x: 0, y });
  for (let y = h - 1; y >= 0; y -= 1) pts.push({ x: 1, y });
  return pts;
}

function mazeFill(w: number, h: number): Point[] | null {
  if (w === 2 && h === 2) return twoByTwo(Math.random() < 0.5);
  if (w === 2 || h === 2) return stripCycle(w, h);
  const tiles: Point[][] = [];
  for (let y = 0; y < h; y += 2) {
    for (let x = 0; x < w; x += 2) {
      const flip = ((x + y) / 2) % 2 === 1;
      tiles.push(offset(twoByTwo(flip), x, y));
    }
  }
  const joined = joinAll(shuffle(tiles), Math.max(w, h));
  if (joined && isSimpleCycle(joined) && joined.length === w * h) return joined;
  return null;
}

function bandFill(w: number, h: number, vertical: boolean): Point[] | null {
  const strips: Point[][] = [];
  if (vertical) {
    for (let x = 0; x < w; x += 2) strips.push(offset(stripCycle(2, h), x, 0));
  } else {
    for (let y = 0; y < h; y += 2) strips.push(offset(stripCycle(w, 2), 0, y));
  }
  const joined = joinAll(strips, Math.max(w, h));
  if (joined && isSimpleCycle(joined) && joined.length === w * h) return joined;
  return null;
}

function splitFour(w: number, h: number): Point[] | null {
  if (w < 8 || h < 8 || w % 2 !== 0 || h % 2 !== 0) return null;
  const hw = w / 2;
  const hh = h / 2;
  if (hw % 2 !== 0 || hh % 2 !== 0) return null;
  const rooms: Room[] = [
    { x: 0, y: 0, w: hw, h: hh },
    { x: hw, y: 0, w: hw, h: hh },
    { x: 0, y: hh, w: hw, h: hh },
    { x: hw, y: hh, w: hw, h: hh },
  ];
  const parts = rooms.map((room) => offset(roomCycle(room.w, room.h, true), room.x, room.y));
  return joinAll(parts, Math.max(w, h));
}

function roomCycle(w: number, h: number, leaf = false): Point[] {
  if (!leaf && w >= 8 && h >= 8 && Math.random() < 0.4) {
    const nested = splitFour(w, h);
    if (nested && isSimpleCycle(nested) && nested.length === w * h) return nested;
  }

  const choices: Point[][] = [];
  const maze = mazeFill(w, h);
  if (maze) choices.push(maze);
  const rings = nestedRings(w, h);
  if (isSimpleCycle(rings) && rings.length === w * h) choices.push(rings);
  const bands = [bandFill(w, h, false), bandFill(w, h, true)].filter(
    (c): c is Point[] => !!c,
  );
  choices.push(...bands);

  if (choices.length) {
    const roll = Math.random();
    if (roll < 0.34 && maze) return maze;
    if (roll < 0.72 && isSimpleCycle(rings) && rings.length === w * h) return rings;
    return pick(choices);
  }
  return serpentine(w, h);
}

function partition(x: number, y: number, w: number, h: number, rooms: Room[]) {
  const canX = w >= 8;
  const canY = h >= 8;
  if (!canX && !canY) {
    rooms.push({ x, y, w, h });
    return;
  }

  const splitX = canX && (!canY || w > h || (w === h && Math.random() < 0.5));
  if (splitX) {
    const options: number[] = [];
    for (let left = 4; left <= w - 4; left += 2) options.push(left);
    const left = pick(options);
    partition(x, y, left, h, rooms);
    partition(x + left, y, w - left, h, rooms);
    return;
  }
  const options: number[] = [];
  for (let top = 4; top <= h - 4; top += 2) options.push(top);
  const top = pick(options);
  partition(x, y, w, top, rooms);
  partition(x, y + top, w, h - top, rooms);
}

function twoOpt(order: Point[], i: number, k: number): Point[] {
  const len = order.length;
  const rotated = order.slice(i).concat(order.slice(0, i));
  const kRot = (k - i + len) % len;
  const out = rotated.slice();
  let a = 1;
  let b = kRot;
  while (a < b) {
    const tmp = out[a];
    out[a] = out[b];
    out[b] = tmp;
    a += 1;
    b -= 1;
  }
  return out;
}

function flipSquare(order: Point[], n: number, x: number, y: number, style: FoldStyle): Point[] | null {
  if (style === "keep") return null;
  const idx = indexOf(order, n);
  const len = order.length;
  const A = idx[y][x];
  const B = idx[y][x + 1];
  const C = idx[y + 1][x];
  const D = idx[y + 1][x + 1];
  if (A < 0 || B < 0 || C < 0 || D < 0) return null;
  const directed = (i: number, j: number) => nextI(i, len) === j;

  const pairs: [number, number][] = [];
  const horizSame =
    (directed(A, B) && directed(C, D)) || (directed(B, A) && directed(D, C));
  const vertSame =
    (directed(A, C) && directed(B, D)) || (directed(C, A) && directed(D, B));

  if (style === "combX" && !horizSame) return null;
  if (style === "combY" && !vertSame) return null;

  if (directed(A, B) && directed(C, D)) pairs.push([A, C]);
  if (directed(B, A) && directed(D, C)) pairs.push([B, D]);
  if (directed(A, C) && directed(B, D)) pairs.push([A, B]);
  if (directed(C, A) && directed(D, B)) pairs.push([C, D]);

  for (const [i, k] of pairs) {
    if (manhattan(order[i], order[k]) !== 1) continue;
    if (manhattan(order[nextI(i, len)], order[nextI(k, len)]) !== 1) continue;
    const flipped = twoOpt(order, i, k);
    if (isSimpleCycle(flipped) && flipped.length === order.length) return flipped;
  }
  return null;
}

function foldRoom(order: Point[], n: number, room: Room, style: FoldStyle) {
  if (style === "keep") return order;
  let cur = order;
  const passes = style === "fold" ? 18 : 12;
  const chance = style === "fold" ? 0.9 : 0.8;
  for (let pass = 0; pass < passes; pass += 1) {
    const squares: { x: number; y: number }[] = [];
    for (let y = room.y; y < room.y + room.h - 1; y += 1) {
      for (let x = room.x; x < room.x + room.w - 1; x += 1) {
        squares.push({ x, y });
      }
    }
    let changed = false;
    for (const sq of shuffle(squares)) {
      if (Math.random() > chance) continue;
      const next = flipSquare(cur, n, sq.x, sq.y, style);
      if (next) {
        cur = next;
        changed = true;
      }
    }
    if (!changed) break;
  }
  return cur;
}

function pickStyles(count: number): FoldStyle[] {
  const pool: FoldStyle[] = ["fold", "fold", "combX", "combY", "combX", "combY", "keep"];
  const styles = Array.from({ length: count }, () => pick(pool));
  if (count >= 3 && !styles.includes("keep")) styles[0] = "keep";
  if (count >= 2 && styles.every((s) => s === styles[0])) styles[1] = pick(["fold", "combX", "combY"]);
  return styles;
}

function texture(order: Point[], n: number): Point[] {
  const rooms: Room[] = [];
  partition(0, 0, n, n, rooms);
  const styles = pickStyles(rooms.length);
  let cur = order;
  for (let i = 0; i < rooms.length; i += 1) {
    cur = foldRoom(cur, n, rooms[i], styles[i]);
  }
  return isSimpleCycle(cur) ? cur : order;
}

function dihedral(order: Point[], n: number, rot: number, mirror: boolean): Point[] {
  return order.map((p) => {
    let x = p.x;
    let y = p.y;
    if (mirror) x = n - 1 - x;
    for (let i = 0; i < rot; i += 1) {
      const nx = n - 1 - y;
      const ny = x;
      x = nx;
      y = ny;
    }
    return { x, y };
  });
}

function isBoardCycle(order: Point[], n: number) {
  return order.length === n * n && isSimpleCycle(order);
}

function cycleStats(order: Point[]) {
  let turns = 0;
  let maxRun = 1;
  let run = 1;
  const len = order.length;
  for (let i = 0; i < len; i += 1) {
    const a = order[i];
    const b = order[nextI(i, len)];
    const c = order[nextI(i + 1, len)];
    const dx1 = b.x - a.x;
    const dy1 = b.y - a.y;
    const dx2 = c.x - b.x;
    const dy2 = c.y - b.y;
    if (dx1 === dx2 && dy1 === dy2) {
      run += 1;
      if (run > maxRun) maxRun = run;
    } else {
      turns += 1;
      run = 1;
    }
  }
  return { turns, maxRun };
}

function wildScore(order: Point[]) {
  const { turns, maxRun } = cycleStats(order);
  return turns * 3 - maxRun * maxRun * 14;
}

function roomsPattern(n: number): Point[] | null {
  const rooms: Room[] = [];
  partition(0, 0, n, n, rooms);
  const parts = rooms.map((room) => offset(roomCycle(room.w, room.h), room.x, room.y));
  const joined = joinAll(parts, n);
  if (joined && isBoardCycle(joined, n)) return joined;
  return null;
}

function buildPattern(n: number): Point[] {
  const maze = mazeFill(n, n);
  if (maze && isBoardCycle(maze, n) && Math.random() < 0.3) return maze;

  for (let i = 0; i < 10; i += 1) {
    const joined = roomsPattern(n);
    if (joined) return joined;
  }

  if (maze && isBoardCycle(maze, n)) return maze;

  const quads = splitFour(n, n);
  if (quads && isBoardCycle(quads, n)) return quads;

  const spiral = nestedRings(n, n);
  if (isBoardCycle(spiral, n)) return spiral;

  return serpentine(n, n);
}

export function generateCycleNext(n: number): Point[][] {
  const candidates: Point[][] = [];
  for (let i = 0; i < 6; i += 1) {
    let order = buildPattern(n);
    if (!isBoardCycle(order, n)) continue;
    order = texture(order, n);
    if (!isBoardCycle(order, n)) continue;
    candidates.push(order);
  }

  let order = candidates.length
    ? candidates.reduce((best, cur) => (wildScore(cur) > wildScore(best) ? cur : best))
    : nestedRings(n, n);

  if (!isBoardCycle(order, n)) order = nestedRings(n, n);
  if (!isBoardCycle(order, n)) order = serpentine(n, n);

  order = dihedral(order, n, Math.floor(Math.random() * 4), Math.random() < 0.5);
  if (!isBoardCycle(order, n)) order = nestedRings(n, n);
  if (!isBoardCycle(order, n)) order = serpentine(n, n);

  const next = Array.from({ length: n }, () => Array<Point>(n));
  for (let i = 0; i < order.length; i += 1) {
    const a = order[i];
    const b = order[nextI(i, order.length)];
    next[a.y][a.x] = b;
  }
  return next;
}

export function cyclePrev(next: Point[][], n: number): Point[][] {
  const prev = Array.from({ length: n }, () => Array<Point>(n));
  for (let y = 0; y < n; y += 1) {
    for (let x = 0; x < n; x += 1) {
      const nxt = next[y][x];
      prev[nxt.y][nxt.x] = { x, y };
    }
  }
  return prev;
}

export function cycleIndex(next: Point[][], n: number): number[][] {
  const index = Array.from({ length: n }, () => Array<number>(n).fill(-1));
  let p = { x: 0, y: 0 };
  for (let i = 0; i < n * n; i += 1) {
    index[p.y][p.x] = i;
    p = next[p.y][p.x];
  }
  return index;
}
