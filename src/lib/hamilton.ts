type Point = { x: number; y: number };

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

function offset(order: Point[], ox: number, oy: number): Point[] {
  return order.map((p) => ({ x: p.x + ox, y: p.y + oy }));
}

function indexOf(order: Point[], w: number, h: number) {
  const index = Array.from({ length: h }, () => Array<number>(w).fill(-1));
  for (let i = 0; i < order.length; i += 1) {
    const p = order[i];
    index[p.y][p.x] = i;
  }
  return index;
}

function toNext(order: Point[], w: number, h: number) {
  const next = Array.from({ length: h }, () => Array<Point>(w));
  for (let i = 0; i < order.length; i += 1) {
    const a = order[i];
    next[a.y][a.x] = order[nextI(i, order.length)];
  }
  return next;
}

function toPrev(order: Point[], w: number, h: number) {
  const prev = Array.from({ length: h }, () => Array<Point>(w));
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

function isBoardCycle(order: Point[], w: number, h: number) {
  return order.length === w * h && isSimpleCycle(order);
}

function canCycle(w: number, h: number) {
  return w >= 2 && h >= 2 && (w % 2 === 0 || h % 2 === 0);
}

function reverseOrder(order: Point[]) {
  return order.slice().reverse();
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

function tightScore(order: Point[]) {
  const { turns, maxRun } = cycleStats(order);
  return maxRun * maxRun * 20 - turns;
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
  w: number,
  h: number,
  p: Point,
  p2: Point,
  q: Point,
  endB: Point,
  walkB: "prev" | "next",
) {
  const nextA = toNext(a, w, h);
  const stepB = walkB === "prev" ? toPrev(b, w, h) : toNext(b, w, h);
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

function mergeCycles(a: Point[], b: Point[], w: number, h: number): Point[] | null {
  const nextB = toNext(b, w, h);
  const prevB = toPrev(b, w, h);
  const idxB = indexOf(b, w, h);
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
      if (q.x < 0 || q.y < 0 || q.x >= w || q.y >= h) continue;
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
  const winners: Point[][] = [];
  let bestScore = -Infinity;
  for (const spot of spots) {
    const merged = spliceCycles(a, b, w, h, spot.p, spot.p2, spot.q, spot.endB, spot.walkB);
    if (!merged) continue;
    const score = tightScore(merged);
    if (score > bestScore) {
      bestScore = score;
      winners.length = 0;
      winners.push(merged);
    } else if (score === bestScore) {
      winners.push(merged);
    }
  }
  return winners.length ? pick(winners) : null;
}

function joinPath(parts: Point[][], w: number, h: number): Point[] | null {
  if (parts.length === 0) return null;
  let acc = parts[0];
  const rest = parts.slice(1);
  while (rest.length) {
    let found = -1;
    let merged: Point[] | null = null;
    for (let i = 0; i < rest.length; i += 1) {
      merged = mergeCycles(acc, rest[i], w, h) ?? mergeCycles(rest[i], acc, w, h);
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

function coil(w: number, h: number): Point[] | null {
  if (!canCycle(w, h)) return null;
  if (w === 2 || h === 2) return stripCycle(w, h);
  const outer = rectRing(w, h, 0);
  const inner = coil(w - 2, h - 2);
  if (!inner) return null;
  const shifted = offset(inner, 1, 1);
  return (
    mergeCycles(outer, shifted, w, h) ??
    mergeCycles(reverseOrder(outer), shifted, w, h) ??
    mergeCycles(outer, reverseOrder(shifted), w, h)
  );
}

function foldVertical(w: number, h: number): Point[] | null {
  if (w % 2 !== 0) return null;
  const parts: Point[][] = [];
  for (let x = 0; x < w; x += 2) parts.push(offset(stripCycle(2, h), x, 0));
  return joinPath(parts, w, h);
}

function foldHorizontal(w: number, h: number): Point[] | null {
  if (h % 2 !== 0) return null;
  const parts: Point[][] = [];
  for (let y = 0; y < h; y += 2) parts.push(offset(stripCycle(w, 2), 0, y));
  return joinPath(parts, w, h);
}

function bandFill(w: number, h: number, band: number, axis: "x" | "y"): Point[] | null {
  if (band < 2 || (axis === "x" ? w : h) < band) return null;
  const parts: Point[][] = [];
  if (axis === "x") {
    for (let x = 0; x < w; ) {
      const bw = Math.min(band, w - x);
      if (!canCycle(bw, h)) return null;
      const piece = bw === 2 ? stripCycle(bw, h) : coil(bw, h);
      if (!piece) return null;
      parts.push(offset(piece, x, 0));
      x += bw;
    }
  } else {
    for (let y = 0; y < h; ) {
      const bh = Math.min(band, h - y);
      if (!canCycle(w, bh)) return null;
      const piece = bh === 2 ? stripCycle(w, bh) : coil(w, bh);
      if (!piece) return null;
      parts.push(offset(piece, 0, y));
      y += bh;
    }
  }
  return joinPath(parts, w, h);
}

function dress(order: Point[], w: number, h: number) {
  let next = Math.random() < 0.5 ? reverseOrder(order) : order;
  const flipX = Math.random() < 0.5;
  const flipY = Math.random() < 0.5;
  return next.map((p) => ({
    x: flipX ? w - 1 - p.x : p.x,
    y: flipY ? h - 1 - p.y : p.y,
  }));
}

function buildTight(w: number, h: number): Point[] | null {
  const builders = [
    () => foldVertical(w, h),
    () => foldVertical(w, h),
    () => foldHorizontal(w, h),
    () => foldHorizontal(w, h),
    () => bandFill(w, h, 4, "x"),
    () => bandFill(w, h, 4, "y"),
  ];
  for (const builder of builders.sort(() => Math.random() - 0.5)) {
    const order = builder();
    if (order && isBoardCycle(order, w, h)) return order;
  }
  return foldVertical(w, h) ?? foldHorizontal(w, h);
}

export function generateCycleNext(w: number, h = w): Point[][] {
  let order = buildTight(w, h);
  if (!order || !isBoardCycle(order, w, h)) order = foldVertical(w, h) ?? foldHorizontal(w, h);
  if (order && isBoardCycle(order, w, h)) order = dress(order, w, h);
  if (!order || !isBoardCycle(order, w, h)) order = coil(w, h);
  if (!order || !isBoardCycle(order, w, h)) order = serpentine(w, h);

  const next = Array.from({ length: h }, () => Array<Point>(w));
  for (let i = 0; i < order.length; i += 1) {
    const a = order[i];
    const b = order[nextI(i, order.length)];
    next[a.y][a.x] = b;
  }
  return next;
}

export function cyclePrev(next: Point[][], w: number, h = w): Point[][] {
  const prev = Array.from({ length: h }, () => Array<Point>(w));
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const nxt = next[y][x];
      prev[nxt.y][nxt.x] = { x, y };
    }
  }
  return prev;
}

export function cycleIndex(next: Point[][], w: number, h = w): number[][] {
  const index = Array.from({ length: h }, () => Array<number>(w).fill(-1));
  let p = { x: 0, y: 0 };
  for (let i = 0; i < w * h; i += 1) {
    index[p.y][p.x] = i;
    p = next[p.y][p.x];
  }
  return index;
}
