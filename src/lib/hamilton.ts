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
  return winners.length ? winners[0] : null;
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

function hamPath(w: number, h: number, start: Point, end: Point): Point[] | null {
  const need = w * h;
  const used = Array.from({ length: h }, () => Array(w).fill(false));
  const path: Point[] = [];

  function walk(cur: Point): boolean {
    path.push(cur);
    used[cur.y][cur.x] = true;
    if (path.length === need) return eq(cur, end);
    if (eq(cur, end)) {
      used[cur.y][cur.x] = false;
      path.pop();
      return false;
    }
    const opts = [
      { x: cur.x + 1, y: cur.y },
      { x: cur.x - 1, y: cur.y },
      { x: cur.x, y: cur.y + 1 },
      { x: cur.x, y: cur.y - 1 },
    ].filter((p) => p.x >= 0 && p.y >= 0 && p.x < w && p.y < h && !used[p.y][p.x]);
    opts.sort((a, b) => {
      const da = Math.abs(a.x - end.x) + Math.abs(a.y - end.y);
      const db = Math.abs(b.x - end.x) + Math.abs(b.y - end.y);
      return da - db;
    });
    for (const next of opts) {
      if (walk(next)) return true;
    }
    used[cur.y][cur.x] = false;
    path.pop();
    return false;
  }

  return walk(start) ? path.map((p) => ({ ...p })) : null;
}

function colZigzag(tw: number, th: number): Point[] {
  const pts: Point[] = [];
  for (let x = 0; x < tw; x += 1) {
    if (x % 2 === 0) {
      for (let y = 0; y < th; y += 1) pts.push({ x, y });
    } else {
      for (let y = th - 1; y >= 0; y -= 1) pts.push({ x, y });
    }
  }
  return pts;
}

function rowZigzag(tw: number, th: number): Point[] {
  const pts: Point[] = [];
  for (let y = 0; y < th; y += 1) {
    if (y % 2 === 0) {
      for (let x = 0; x < tw; x += 1) pts.push({ x, y });
    } else {
      for (let x = tw - 1; x >= 0; x -= 1) pts.push({ x, y });
    }
  }
  return pts;
}

function inwardSpiral(tw: number, th: number): Point[] {
  const pts: Point[] = [];
  let x0 = 0;
  let y0 = 0;
  let x1 = tw - 1;
  let y1 = th - 1;
  while (x0 <= x1 && y0 <= y1) {
    for (let x = x0; x <= x1; x += 1) pts.push({ x, y: y0 });
    for (let y = y0 + 1; y <= y1; y += 1) pts.push({ x: x1, y });
    if (y0 < y1) {
      for (let x = x1 - 1; x >= x0; x -= 1) pts.push({ x, y: y1 });
    }
    if (x0 < x1) {
      for (let y = y1 - 1; y > y0; y -= 1) pts.push({ x: x0, y });
    }
    x0 += 1;
    y0 += 1;
    x1 -= 1;
    y1 -= 1;
  }
  return pts;
}

function pathStats(order: Point[]) {
  let turns = 0;
  let maxRun = 1;
  let run = 1;
  for (let i = 1; i < order.length - 1; i += 1) {
    const a = order[i - 1];
    const b = order[i];
    const c = order[i + 1];
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

function allHamPaths(tw: number, th: number): Point[][] {
  const need = tw * th;
  const out: Point[][] = [];
  const used = Array.from({ length: th }, () => Array<boolean>(tw).fill(false));
  const path: Point[] = [];
  const dirs: Point[] = [
    { x: 1, y: 0 },
    { x: -1, y: 0 },
    { x: 0, y: 1 },
    { x: 0, y: -1 },
  ];
  function dfs() {
    if (path.length === need) {
      out.push(path.map((p) => ({ x: p.x, y: p.y })));
      return;
    }
    const last = path[path.length - 1];
    for (const d of dirs) {
      const x = last.x + d.x;
      const y = last.y + d.y;
      if (x < 0 || y < 0 || x >= tw || y >= th || used[y][x]) continue;
      used[y][x] = true;
      path.push({ x, y });
      dfs();
      path.pop();
      used[y][x] = false;
    }
  }
  for (let y = 0; y < th; y += 1) {
    for (let x = 0; x < tw; x += 1) {
      used[y][x] = true;
      path.push({ x, y });
      dfs();
      path.pop();
      used[y][x] = false;
    }
  }
  return out;
}

const stairFillCache = new Map<string, Point[][]>();

function stairFills(tw: number, th: number): Point[][] {
  const key = `${tw}x${th}`;
  const cached = stairFillCache.get(key);
  if (cached) return cached;
  const best = new Map<string, { path: Point[]; turns: number; maxRun: number }>();
  for (const path of allHamPaths(tw, th)) {
    const { turns, maxRun } = pathStats(path);
    if (maxRun > 2) continue;
    const start = path[0];
    const end = path[path.length - 1];
    const k = `${start.x},${start.y}->${end.x},${end.y}`;
    const prev = best.get(k);
    if (!prev || maxRun < prev.maxRun || (maxRun === prev.maxRun && turns > prev.turns)) {
      best.set(k, { path, turns, maxRun });
    }
  }
  const fills = [...best.values()].map((v) => v.path);
  stairFillCache.set(key, fills);
  return fills;
}

function crenel(tw: number, th: number, phase = 0): Point[] {
  const pts: Point[] = [];
  if (tw === 2) {
    for (let y = 0; y < th; y += 1) {
      if ((y + phase) % 2 === 0) pts.push({ x: 0, y }, { x: 1, y });
      else pts.push({ x: 1, y }, { x: 0, y });
    }
    return pts;
  }
  if (th === 2) {
    for (let x = 0; x < tw; x += 1) {
      if ((x + phase) % 2 === 0) pts.push({ x, y: 0 }, { x, y: 1 });
      else pts.push({ x, y: 1 }, { x, y: 0 });
    }
    return pts;
  }
  return rowZigzag(tw, th);
}

function fillsFromBases(tw: number, th: number, bases: Point[][]): Point[][] {
  const out: Point[][] = [];
  const seen = new Set<string>();

  function add(order: Point[]) {
    if (order.length !== tw * th) return;
    const key = order.map((p) => `${p.x},${p.y}`).join(">");
    if (seen.has(key)) return;
    seen.add(key);
    out.push(order);
  }

  for (const base of bases) {
    const flips = [
      base,
      base.map((p) => ({ x: tw - 1 - p.x, y: p.y })),
      base.map((p) => ({ x: p.x, y: th - 1 - p.y })),
      base.map((p) => ({ x: tw - 1 - p.x, y: th - 1 - p.y })),
    ];
    for (const flipped of flips) {
      add(flipped);
      add(reverseOrder(flipped));
      if (tw === th) {
        const rot = flipped.map((p) => ({ x: tw - 1 - p.y, y: p.x }));
        add(rot);
        add(reverseOrder(rot));
      }
    }
  }
  return out;
}

function crenelFills(tw: number, th: number): Point[][] {
  return fillsFromBases(tw, th, [crenel(tw, th, 0), crenel(tw, th, 1)]);
}

function tileFills(tw: number, th: number): Point[][] {
  return fillsFromBases(tw, th, [
    crenel(tw, th, 0),
    crenel(tw, th, 1),
    inwardSpiral(tw, th),
    colZigzag(tw, th),
    rowZigzag(tw, th),
  ]);
}

function gridHamCycle(nx: number, ny: number): Point[] | null {
  if (nx < 2 || ny < 2) return null;
  // Walk along rows of tiles first so 1x1 folds repeat across the board
  // instead of one long vertical strip down the left.
  if (nx % 2 === 0) {
    return cycleEvenHeight(ny, nx).map((p) => ({ x: p.y, y: p.x }));
  }
  if (ny % 2 === 0) return cycleEvenHeight(nx, ny);
  return null;
}

function squareFills(): Point[][] {
  const cw = [
    { x: 0, y: 0 },
    { x: 0, y: 1 },
    { x: 1, y: 1 },
    { x: 1, y: 0 },
  ];
  const out: Point[][] = [];
  const seen = new Set<string>();
  function add(order: Point[]) {
    const key = order.map((p) => `${p.x},${p.y}`).join(">");
    if (seen.has(key)) return;
    seen.add(key);
    out.push(order);
  }
  let cur = cw;
  for (let i = 0; i < 4; i += 1) {
    add(cur);
    add(reverseOrder(cur));
    cur = cur.map((_, idx) => cur[(idx + 1) % 4]);
  }
  return out;
}

function cycleEvenHeight(nx: number, ny: number): Point[] {
  const pts: Point[] = [];
  for (let y = 0; y < ny; y += 1) pts.push({ x: 0, y });
  for (let y = ny - 1; y >= 0; y -= 1) {
    if ((ny - 1 - y) % 2 === 0) {
      for (let x = 1; x < nx; x += 1) pts.push({ x, y });
    } else {
      for (let x = nx - 1; x >= 1; x -= 1) pts.push({ x, y });
    }
  }
  return pts;
}

function inBox(p: Point, box: { ox: number; oy: number }, tw: number, th: number) {
  return p.x >= box.ox && p.y >= box.oy && p.x < box.ox + tw && p.y < box.oy + th;
}

function neighborInBox(p: Point, box: { ox: number; oy: number }, tw: number, th: number) {
  return (
    [
      { x: p.x + 1, y: p.y },
      { x: p.x - 1, y: p.y },
      { x: p.x, y: p.y + 1 },
      { x: p.x, y: p.y - 1 },
    ].find((q) => inBox(q, box, tw, th)) ?? null
  );
}

function sharedEdge(
  box: { ox: number; oy: number },
  other: { ox: number; oy: number },
  tw: number,
  th: number,
) {
  const cells: Point[] = [];
  for (let y = 0; y < th; y += 1) {
    for (let x = 0; x < tw; x += 1) {
      const p = { x: box.ox + x, y: box.oy + y };
      if (neighborInBox(p, other, tw, th)) cells.push(p);
    }
  }
  return cells;
}

function tiledSpiral(
  w: number,
  h: number,
  tw: number,
  th: number,
  fillsOverride?: Point[][],
  allowHamPath = true,
): Point[] | null {
  if (w % tw !== 0 || h % th !== 0) return null;
  const tiles = gridHamCycle(w / tw, h / th);
  if (!tiles || tiles.length !== (w / tw) * (h / th)) return null;
  const boxes = tiles.map((t) => ({ ox: t.x * tw, oy: t.y * th }));
  const n = boxes.length;
  const fills =
    fillsOverride ?? (tw === 2 && th === 2 ? squareFills() : tileFills(tw, th));
  const starts = sharedEdge(boxes[0], boxes[n - 1], tw, th);
  const attempts = starts.length ? starts : [{ x: boxes[0].ox, y: boxes[0].oy }];

  for (const start0 of attempts) {
    const stitched = stitchTiles(boxes, fills, start0, tw, th, w, h, allowHamPath);
    if (stitched) return stitched;
  }
  return null;
}

function stitchTiles(
  boxes: { ox: number; oy: number }[],
  fills: Point[][],
  start0: Point,
  tw: number,
  th: number,
  w: number,
  h: number,
  allowHamPath = true,
): Point[] | null {
  const n = boxes.length;
  const out: Point[] = [];
  let start = start0;
  let inbound: Point | null = null;

  for (let i = 0; i < n; i += 1) {
    const box = boxes[i];
    const nxt = boxes[(i + 1) % n];
    const localStart = { x: start.x - box.ox, y: start.y - box.oy };
    const piece = pickFill(
      fills,
      localStart,
      box,
      nxt,
      tw,
      th,
      i === n - 1 ? start0 : null,
      allowHamPath,
      inbound,
    );
    if (!piece) return null;
    out.push(...piece);
    if (i < n - 1) {
      const end = piece[piece.length - 1];
      const step = neighborInBox(end, nxt, tw, th);
      if (!step) return null;
      inbound = { x: step.x - end.x, y: step.y - end.y };
      start = step;
    }
  }

  return isBoardCycle(out, w, h) ? out : null;
}

function pickFill(
  fills: Point[][],
  localStart: Point,
  box: { ox: number; oy: number },
  nxt: { ox: number; oy: number },
  tw: number,
  th: number,
  closeTo: Point | null,
  allowHamPath = true,
  inbound: Point | null = null,
): Point[] | null {
  let best: Point[] | null = null;
  let bestScore = -Infinity;
  for (const fill of fills) {
    if (!eq(fill[0], localStart)) continue;
    const world = offset(fill, box.ox, box.oy);
    const end = world[world.length - 1];
    const ok = closeTo ? manhattan(end, closeTo) === 1 : Boolean(neighborInBox(end, nxt, tw, th));
    if (!ok) continue;
    const { maxRun, turns } = pathStats(fill);
    let score = turns * 10 - maxRun * maxRun + (maxRun <= 1 ? 80 : maxRun <= 2 ? 20 : 0);
    if (inbound && fill.length > 1) {
      const first = { x: fill[1].x - fill[0].x, y: fill[1].y - fill[0].y };
      if (first.x === inbound.x && first.y === inbound.y) score -= 140;
    }
    if (fill.length > 1) {
      const last = fill[fill.length - 1];
      const prev = fill[fill.length - 2];
      const lastDir = { x: last.x - prev.x, y: last.y - prev.y };
      const exit = closeTo ?? neighborInBox(end, nxt, tw, th);
      if (exit) {
        const exitDir = { x: exit.x - end.x, y: exit.y - end.y };
        if (exitDir.x === lastDir.x && exitDir.y === lastDir.y) score -= 140;
      }
    }
    if (score > bestScore) {
      bestScore = score;
      best = world;
    }
  }
  if (best) return best;
  if (!allowHamPath) return null;

  const exits = sharedEdge(box, nxt, tw, th);
  for (const end of exits) {
    if (eq(end, { x: box.ox + localStart.x, y: box.oy + localStart.y }) && tw * th > 1) {
      continue;
    }
    if (closeTo && manhattan(end, closeTo) !== 1) continue;
    if (!closeTo && !neighborInBox(end, nxt, tw, th)) continue;
    const path = hamPath(tw, th, localStart, { x: end.x - box.ox, y: end.y - box.oy });
    if (path) return offset(path, box.ox, box.oy);
  }
  return null;
}

function reverseBetween(order: Point[], from: number, to: number): Point[] | null {
  const n = order.length;
  if (from === to) return null;
  const inds: number[] = [];
  let i = from;
  while (true) {
    inds.push(i);
    if (i === to) break;
    i = nextI(i, n);
    if (inds.length > n) return null;
  }
  if (inds.length < 3 || inds.length > n - 3) return null;
  const out = order.slice();
  for (let k = 0; k < inds.length; k += 1) {
    out[inds[k]] = order[inds[inds.length - 1 - k]];
  }
  return out;
}

function switchQuad(order: Point[], w: number, h: number, a: Point, b: Point): Point[] | null {
  const idx = indexOf(order, w, h);
  const n = order.length;
  const ia = idx[a.y]?.[a.x] ?? -1;
  const ib = idx[b.y]?.[b.x] ?? -1;
  if (ia < 0 || ib < 0 || nextI(ia, n) !== ib) return null;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const normals: Point[] = [
    { x: -dy, y: dx },
    { x: dy, y: -dx },
  ];
  for (const nrm of normals) {
    const c = { x: a.x + nrm.x, y: a.y + nrm.y };
    const d = { x: b.x + nrm.x, y: b.y + nrm.y };
    if (c.x < 0 || c.y < 0 || c.x >= w || c.y >= h) continue;
    if (d.x < 0 || d.y < 0 || d.x >= w || d.y >= h) continue;
    const ic = idx[c.y][c.x];
    const id = idx[d.y][d.x];
    if (ic < 0 || id < 0) continue;
    const cand =
      nextI(ic, n) === id
        ? reverseBetween(order, ib, ic)
        : nextI(id, n) === ic
          ? reverseBetween(order, ib, id)
          : null;
    if (cand && isBoardCycle(cand, w, h)) return cand;
  }
  return null;
}

function addTeeth(order: Point[], w: number, h: number, budget = 16): Point[] {
  let cur = order;
  let used = 0;
  for (let y = 1; y < h - 1; y += 1) {
    for (let x = 1; x < w - 2; x += 2) {
      if ((x + 2 * y) % 5 !== 0) continue;
      const next = switchQuad(cur, w, h, { x, y }, { x: x + 1, y });
      if (!next) continue;
      cur = next;
      used += 1;
      if (used >= budget) return cur;
    }
  }
  for (let x = 1; x < w - 1; x += 1) {
    for (let y = 1; y < h - 2; y += 2) {
      if ((y + 3 * x) % 5 !== 1) continue;
      const next = switchQuad(cur, w, h, { x, y }, { x, y: y + 1 });
      if (!next) continue;
      cur = next;
      used += 1;
      if (used >= budget) return cur;
    }
  }
  return cur;
}

function coilWithZipperCore(w: number, h: number): Point[] | null {
  if (!canCycle(w, h)) return null;
  if (w <= 6 && h <= 6) {
    return tiledSpiral(w, h, 2, 2) ?? coil(w, h);
  }
  const outer = rectRing(w, h, 0);
  const inner = coilWithZipperCore(w - 2, h - 2);
  if (!inner) return null;
  const shifted = offset(inner, 1, 1);
  return (
    mergeCycles(outer, shifted, w, h) ??
    mergeCycles(reverseOrder(outer), shifted, w, h) ??
    mergeCycles(outer, reverseOrder(shifted), w, h)
  );
}

function snailShell(w: number, h: number): Point[] | null {
  const gap = h >= 12 && h % 2 === 0 ? 4 : 0;
  if (!gap || h - gap < 8) {
    const all = coilWithZipperCore(w, h);
    return all && isBoardCycle(all, w, h) ? addTeeth(all, w, h) : all;
  }
  const topH = h - gap;
  const top = coilWithZipperCore(w, topH);
  const bot = coil(w, gap);
  if (!top || !bot) return null;
  const toothed = addTeeth(top, w, topH, 12);
  const merged =
    mergeCycles(toothed, offset(bot, 0, topH), w, h) ??
    mergeCycles(offset(bot, 0, topH), toothed, w, h);
  return merged && isBoardCycle(merged, w, h) ? merged : null;
}

function mergeEither(a: Point[], b: Point[], w: number, h: number): Point[] | null {
  return (
    mergeCycles(a, b, w, h) ??
    mergeCycles(b, a, w, h) ??
    mergeCycles(a, reverseOrder(b), w, h) ??
    mergeCycles(reverseOrder(b), a, w, h) ??
    mergeCycles(reverseOrder(a), b, w, h) ??
    mergeCycles(b, reverseOrder(a), w, h)
  );
}

function joinVariants(parts: Point[][], w: number, h: number): Point[] | null {
  if (parts.length === 0) return null;
  let accs: Point[][] = [parts[0], reverseOrder(parts[0])];
  for (let i = 1; i < parts.length; i += 1) {
    const part = parts[i];
    const next: Point[][] = [];
    const seen = new Set<string>();
    for (const acc of accs) {
      for (const piece of [part, reverseOrder(part)]) {
        const merged = mergeEither(acc, piece, w, h);
        if (!merged) continue;
        const key = `${merged[0].x},${merged[0].y}:${merged.length}`;
        if (seen.has(key)) continue;
        seen.add(key);
        next.push(merged);
      }
    }
    if (next.length === 0) return null;
    accs = next.slice(0, 6);
  }
  const need = parts.reduce((sum, p) => sum + p.length, 0);
  return accs.find((p) => isSimpleCycle(p) && p.length === need) ?? null;
}

function rectCycle(rw: number, rh: number, ox = 0, oy = 0): Point[] | null {
  const raw = coil(rw, rh);
  if (!raw) return null;
  return offset(raw, ox, oy);
}

function twinMid(w: number, h: number): Point[] | null {
  if (w < 16 || w % 2 !== 0 || h % 2 !== 0) return null;
  const midW = 4;
  const wing = (w - midW) / 2;
  if (wing < 6 || wing % 2 !== 0) return null;
  const left = rectCycle(wing, h, 0, 0);
  const mid = rectCycle(midW, h, wing, 0);
  const right = rectCycle(wing, h, wing + midW, 0);
  if (!left || !mid || !right) return null;
  const joined = joinVariants([left, mid, right], w, h);
  return joined && isBoardCycle(joined, w, h) ? joined : null;
}

function twinSpiral(w: number, h: number): Point[] | null {
  return twinMid(w, h);
}

function twinHorizontal(w: number, h: number): Point[] | null {
  if (h < 16 || w % 2 !== 0 || h % 2 !== 0) return null;
  const midH = 4;
  const wing = (h - midH) / 2;
  if (wing < 6 || wing % 2 !== 0) return null;
  const top = rectCycle(w, wing, 0, 0);
  const mid = rectCycle(w, midH, 0, wing);
  const bot = rectCycle(w, wing, 0, wing + midH);
  if (!top || !mid || !bot) return null;
  const joined = joinVariants([top, mid, bot], w, h);
  return joined && isBoardCycle(joined, w, h) ? joined : null;
}

function quadSpiral(w: number, h: number): Point[] | null {
  if (w < 16 || h < 16 || w % 2 !== 0 || h % 2 !== 0) return null;
  const midW = 4;
  const midH = 4;
  const wingX = (w - midW) / 2;
  const wingY = (h - midH) / 2;
  if (wingX < 6 || wingY < 6 || wingX % 2 !== 0 || wingY % 2 !== 0) return null;
  const tl = rectCycle(wingX, wingY, 0, 0);
  const tm = rectCycle(midW, wingY, wingX, 0);
  const tr = rectCycle(wingX, wingY, wingX + midW, 0);
  const ml = rectCycle(wingX, midH, 0, wingY);
  const mc = rectCycle(midW, midH, wingX, wingY);
  const mr = rectCycle(wingX, midH, wingX + midW, wingY);
  const bl = rectCycle(wingX, wingY, 0, wingY + midH);
  const bm = rectCycle(midW, wingY, wingX, wingY + midH);
  const br = rectCycle(wingX, wingY, wingX + midW, wingY + midH);
  if (!tl || !tm || !tr || !ml || !mc || !mr || !bl || !bm || !br) return null;
  const top = joinVariants([tl, tm, tr], w, h);
  const mid = joinVariants([ml, mc, mr], w, h);
  const bot = joinVariants([bl, bm, br], w, h);
  if (!top || !mid || !bot) return null;
  const joined = joinVariants([top, mid, bot], w, h);
  return joined && isBoardCycle(joined, w, h) ? joined : null;
}

function rowWaves(
  rw: number,
  rh: number,
  ox: number,
  oy: number,
  boardW: number,
  boardH: number,
  band = 4,
): Point[] | null {
  if (rh % band !== 0 || band < 2) return null;
  const parts: Point[][] = [];
  for (let y = 0; y < rh; y += band) {
    const piece = rectCycle(rw, band, ox, oy + y);
    if (!piece) return null;
    parts.push(piece);
  }
  return joinVariants(parts, boardW, boardH);
}

function halfSplit(w: number, h: number): Point[] | null {
  if (w < 12 || w % 2 !== 0 || h % 4 !== 0) return null;
  const leftW = w / 2;
  const left = rectCycle(leftW, h, 0, 0);
  const waves = rowWaves(w - leftW, h, leftW, 0, w, h, 4);
  if (!left || !waves) return null;
  const joined = joinVariants([left, waves], w, h);
  return joined && isBoardCycle(joined, w, h) ? joined : null;
}

function stepsVertical(w: number, h: number): Point[] | null {
  return (
    tiledSpiral(w, h, 2, 4, stairFills(2, 4), false) ??
    tiledSpiral(w, h, 2, 4, crenelFills(2, 4), false) ??
    tiledSpiral(w, h, 2, 4)
  );
}

function stepsHorizontal(w: number, h: number): Point[] | null {
  return (
    tiledSpiral(w, h, 4, 2, stairFills(4, 2), false) ??
    tiledSpiral(w, h, 4, 2, crenelFills(4, 2), false) ??
    tiledSpiral(w, h, 4, 2)
  );
}

function combFoldsRight(w: number, h: number): Point[] | null {
  if (w < 6 || h < 4 || w % 2 !== 0 || h % 2 !== 0) return null;
  const pts: Point[] = [];
  for (let y = 0; y < h; y += 1) {
    if (y % 2 === 0) pts.push({ x: 1, y }, { x: 0, y });
    else pts.push({ x: 0, y }, { x: 1, y });
  }
  for (let y0 = h - 2; y0 >= 0; y0 -= 2) {
    const yBot = y0 + 1;
    const yTop = y0;
    for (let x = 2; x < w; x += 1) pts.push({ x, y: yBot });
    for (let x = w - 1; x >= 2; x -= 1) pts.push({ x, y: yTop });
  }
  return isBoardCycle(pts, w, h) ? pts : null;
}

function flipX(order: Point[], w: number): Point[] {
  return order.map((p) => ({ x: w - 1 - p.x, y: p.y }));
}

function flipY(order: Point[], h: number): Point[] {
  return order.map((p) => ({ x: p.x, y: h - 1 - p.y }));
}

function swapXY(order: Point[]): Point[] {
  return order.map((p) => ({ x: p.y, y: p.x }));
}

function combCycle(w: number, h: number, kind: "left" | "right" | "top" | "bottom"): Point[] | null {
  if (kind === "right") return combFoldsRight(w, h);
  if (kind === "left") {
    const raw = combFoldsRight(w, h);
    return raw && isBoardCycle(raw, w, h) ? flipX(raw, w) : null;
  }
  if (kind === "top") {
    const raw = combFoldsRight(h, w);
    const swapped = raw ? swapXY(raw) : null;
    return swapped && isBoardCycle(swapped, w, h) ? swapped : null;
  }
  const raw = combFoldsRight(h, w);
  const swapped = raw ? swapXY(raw) : null;
  if (!swapped || !isBoardCycle(swapped, w, h)) return null;
  const flipped = flipY(swapped, h);
  return isBoardCycle(flipped, w, h) ? flipped : null;
}

function basementSnail(w: number, h: number, gap: number): Point[] | null {
  if (gap < 2 || h - gap < 8 || h % 2 !== 0 || gap % 2 !== 0) return null;
  const top = coil(w, h - gap);
  const bot = coil(w, gap);
  if (!top || !bot) return null;
  const merged = mergeEither(top, offset(bot, 0, h - gap), w, h);
  return merged && isBoardCycle(merged, w, h) ? merged : null;
}

function startTopLeft(order: Point[]): Point[] {
  const i = order.findIndex((p) => p.x === 0 && p.y === 0);
  if (i < 0) return order;
  const rot = order.slice(i).concat(order.slice(0, i));
  const nxt = rot[1];
  if (nxt && nxt.x === 0 && nxt.y === 1) return rot;
  const rev = reverseOrder(rot);
  const j = rev.findIndex((p) => p.x === 0 && p.y === 0);
  const rot2 = j < 0 ? rev : rev.slice(j).concat(rev.slice(0, j));
  if (rot2[1] && rot2[1].x === 0 && rot2[1].y === 1) return rot2;
  return rot;
}

let lastCycleKind = "none";

export function cycleKind() {
  return lastCycleKind;
}

export function generateCycleNext(w: number, h = w): Point[][] {
  lastCycleKind = "none";
  const builders: [string, () => Point[] | null][] = [
    ["comb", () => combCycle(w, h, "right")],
    ["comb", () => combCycle(w, h, "left")],
    ["comb-h", () => combCycle(w, h, "top")],
    ["comb-h", () => combCycle(w, h, "bottom")],
  ];
  const start = Math.floor(Math.random() * builders.length);
  let order: Point[] | null = null;
  for (let i = 0; i < builders.length; i += 1) {
    const [name, build] = builders[(start + i) % builders.length];
    const cand = build();
    if (cand && isBoardCycle(cand, w, h)) {
      order = startTopLeft(cand);
      lastCycleKind = name;
      break;
    }
  }
  if (!order || !isBoardCycle(order, w, h)) {
    order = coil(w, h);
    if (order && isBoardCycle(order, w, h)) lastCycleKind = "coil";
  }
  if (!order || !isBoardCycle(order, w, h)) {
    order = tiledSpiral(w, h, 2, 2);
    if (order && isBoardCycle(order, w, h)) lastCycleKind = "tile-2x2";
  }
  if (!order || !isBoardCycle(order, w, h)) {
    order = serpentine(w, h);
    lastCycleKind = "serpentine";
  }
  order = startTopLeft(order);

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
