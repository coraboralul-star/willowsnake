type Point = { x: number; y: number };

function eq(a: Point, b: Point) {
  return a.x === b.x && a.y === b.y;
}

function nextI(i: number, len: number) {
  return (i + 1) % len;
}

function colSerpentine(n: number): Point[] {
  const order: Point[] = [];
  let x = 0;
  let y = 0;
  for (let i = 0; i < n * n; i += 1) {
    order.push({ x, y });
    const nxt = colNext(x, y, n);
    x = nxt.x;
    y = nxt.y;
  }
  return order;
}

function colNext(x: number, y: number, n: number): Point {
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

function rowSerpentine(n: number): Point[] {
  return colSerpentine(n).map((p) => ({ x: p.y, y: p.x }));
}

function ringCells(n: number, k: number): Point[] {
  const x0 = k;
  const y0 = k;
  const x1 = n - 1 - k;
  const y1 = n - 1 - k;
  if (x1 === x0 + 1 && y1 === y0 + 1) {
    return [
      { x: x0, y: y0 },
      { x: x1, y: y0 },
      { x: x1, y: y1 },
      { x: x0, y: y1 },
    ];
  }
  const pts: Point[] = [];
  for (let x = x0; x < x1; x += 1) pts.push({ x, y: y0 });
  for (let y = y0; y < y1; y += 1) pts.push({ x: x1, y });
  for (let x = x1; x > x0; x -= 1) pts.push({ x, y: y1 });
  for (let y = y1; y > y0; y -= 1) pts.push({ x: x0, y });
  return pts;
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

function mergeCycles(a: Point[], b: Point[], n: number): Point[] | null {
  const nextA = toNext(a, n);
  const prevB = toPrev(b, n);
  const idxB = indexOf(b, n);
  const spots: { p: Point; p2: Point; q: Point; q2: Point }[] = [];

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
      const q2 = b[nextI(idxB[q.y][q.x], b.length)];
      if (Math.abs(p2.x - q2.x) + Math.abs(p2.y - q2.y) !== 1) continue;
      spots.push({ p, p2, q, q2 });
    }
  }

  if (spots.length === 0) return null;
  const { p, p2, q, q2 } = spots[Math.floor(Math.random() * spots.length)];
  const out: Point[] = [p];
  let cur = q;
  for (let k = 0; k < b.length; k += 1) {
    out.push(cur);
    if (eq(cur, q2)) break;
    cur = prevB[cur.y][cur.x];
  }
  cur = p2;
  while (!eq(cur, p)) {
    out.push(cur);
    cur = nextA[cur.y][cur.x];
  }
  return out;
}

function mergedRings(n: number): Point[] {
  const rings = n / 2;
  let cycle = ringCells(n, 0);
  for (let k = 1; k < rings; k += 1) {
    const inner = ringCells(n, k);
    const merged = mergeCycles(cycle, inner, n);
    if (!merged) return colSerpentine(n);
    cycle = merged;
  }
  return cycle;
}

function indexOf(order: Point[], n: number) {
  const index = Array.from({ length: n }, () => Array<number>(n).fill(-1));
  for (let i = 0; i < order.length; i += 1) {
    const p = order[i];
    index[p.y][p.x] = i;
  }
  return index;
}

function reverseArc(order: Point[], from: number, to: number) {
  const len = order.length;
  const slice: Point[] = [];
  let i = from;
  while (true) {
    slice.push(order[i]);
    if (i === to) break;
    i = nextI(i, len);
  }
  slice.reverse();
  i = from;
  for (const p of slice) {
    order[i] = p;
    i = nextI(i, len);
  }
}

function tryFlip(order: Point[], n: number, x: number, y: number) {
  const index = indexOf(order, n);
  const A = index[y][x];
  const B = index[y][x + 1];
  const C = index[y + 1][x + 1];
  const D = index[y + 1][x];
  const len = order.length;
  const nxt = (i: number) => nextI(i, len);
  const pairs: [number, number, number, number][] = [
    [A, B, D, C],
    [B, A, C, D],
    [A, D, B, C],
    [D, A, C, B],
  ];
  for (const [p, q, r, s] of pairs) {
    if (nxt(p) === q && nxt(r) === s) {
      reverseArc(order, q, r);
      return true;
    }
  }
  return false;
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

function isCycle(order: Point[], n: number) {
  if (order.length !== n * n) return false;
  const seen = new Set<string>();
  for (let i = 0; i < order.length; i += 1) {
    const a = order[i];
    const b = order[nextI(i, order.length)];
    if (Math.abs(a.x - b.x) + Math.abs(a.y - b.y) !== 1) return false;
    const id = `${a.x},${a.y}`;
    if (seen.has(id)) return false;
    seen.add(id);
  }
  return seen.size === n * n;
}

function scramble(order: Point[], n: number) {
  const tries = n * n * (6 + Math.floor(Math.random() * 10));
  for (let i = 0; i < tries; i += 1) {
    const x = Math.floor(Math.random() * (n - 1));
    const y = Math.floor(Math.random() * (n - 1));
    tryFlip(order, n, x, y);
  }
}

export function generateCycleNext(n: number): Point[][] {
  const roll = Math.random();
  let order =
    roll < 0.34 ? colSerpentine(n) : roll < 0.67 ? rowSerpentine(n) : mergedRings(n);
  scramble(order, n);
  order = dihedral(order, n, Math.floor(Math.random() * 4), Math.random() < 0.5);
  scramble(order, n);
  if (!isCycle(order, n)) order = dihedral(colSerpentine(n), n, Math.floor(Math.random() * 4), Math.random() < 0.5);

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
