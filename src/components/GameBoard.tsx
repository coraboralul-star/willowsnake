"use client";

import { useEffect, useRef, type RefObject } from "react";
import confetti from "canvas-confetti";
import {
  BASE_TICK,
  spinePath,
  type Direction,
  type Food,
  type GameState,
  type Point,
} from "@/lib/engine";
import { onLiveAlert } from "@/lib/gifts";
import { isPageVisible, onPageVisibility } from "@/lib/pageVisible";
import { resumeAudio } from "@/lib/sfx";

type GameBoardProps = {
  liveRef: RefObject<GameState>;
  advance: (now: number) => void;
};

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  color: string;
};

type Floater = {
  x: number;
  y: number;
  life: number;
  max: number;
  text: string;
};

const COLORS = {
  cellA: "#F3E7C4",
  cellB: "#E4D5A4",
  snakeDark: "#1B5E20",
  snakeMid: "#43A047",
  snakeLite: "#A5D6A7",
  eye: "#FFF8E7",
  pupil: "#1A2A18",
  tongue: "#E53935",
  food: "#E53935",
  foodDark: "#B71C1C",
  foodGlow: "rgba(229, 57, 53, 0.22)",
};

export function GameBoard({ liveRef, advance }: GameBoardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const advanceRef = useRef(advance);

  useEffect(() => {
    advanceRef.current = advance;
  }, [advance]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let frame = 0;
    let ticker = 0;
    let width = 0;
    let height = 0;
    let lastAte = 0;
    let lastTs = performance.now();
    const particles: Particle[] = [];
    const floaters: Floater[] = [];
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const resize = () => {
      const cols = liveRef.current.cols;
      const rows = liveRef.current.rows;
      const size = Math.floor(wrap.clientWidth);
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = size;
      height = Math.floor((size * rows) / cols);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.imageSmoothingEnabled = true;
    };

    const observer = new ResizeObserver(resize);
    observer.observe(wrap);
    resize();

    const draw = (now: number) => {
      advanceRef.current(now);

      const state = liveRef.current;
      const cols = state.cols;
      const rows = state.rows;
      const cell = width / cols;
      const dt = Math.min(32, now - lastTs);
      lastTs = now;
      const progress = reduced
        ? 1
        : state.status === "playing"
          ? Math.min(1, Math.max(0, (now - state.tickStartedAt) / state.tickMs))
          : state.status === "paused"
            ? state.pauseT
            : 1;

      if (state.ateAt && state.ateAt !== lastAte) {
        lastAte = state.ateAt;
        spawnBite(particles, floaters, state.snake[0], cell, canvas, state.score, state.pendingGrow);
      }

      ctx.clearRect(0, 0, width, height);
      drawBoard(ctx, width, height, cols, rows, cell);
      drawEatFlash(ctx, width, height, now, state.ateAt);
      drawFoods(ctx, state.foods, cell, now);
      stepFx(particles, floaters, dt);

      const points = spinePath(state.prevSnake, state.snake, progress);
      const facing = facingFrom(state.prevSnake[0], state.snake[0], state.direction);
      drawSnake(ctx, points, cell, facing, now, state.ateAt, now < state.glowUntil);
      drawFx(ctx, particles, floaters, cell);

      frame = requestAnimationFrame(draw);
    };

    const syncLoop = (visible = isPageVisible()) => {
      cancelAnimationFrame(frame);
      window.clearInterval(ticker);
      frame = 0;
      ticker = 0;
      resumeAudio();
      if (visible) {
        lastTs = performance.now();
        lastAte = liveRef.current.ateAt;
        frame = requestAnimationFrame(draw);
        return;
      }
      ticker = window.setInterval(() => {
        resumeAudio();
        advanceRef.current(performance.now());
      }, liveRef.current.tickMs || BASE_TICK);
    };

    const stopWatching = onPageVisibility(syncLoop);
    const stopAlerts = onLiveAlert((alert) => {
      const rect = canvas.getBoundingClientRect();
      const palette =
        alert.tone === "golden"
          ? ["#F9A825", "#FFF8E7", "#FFD54F"]
          : alert.tone === "nitro"
            ? ["#29B6F6", "#FFF8E7", "#43A047"]
            : ["#E53935", "#43A047", "#F9A825", "#FFF8E7"];
      confetti({
        particleCount: alert.tone === "rose" ? 24 : 90,
        spread: 72,
        startVelocity: 32,
        gravity: 0.85,
        ticks: 180,
        origin: {
          x: (rect.left + rect.width / 2) / window.innerWidth,
          y: (rect.top + rect.height * 0.35) / window.innerHeight,
        },
        colors: palette,
      });
    });
    syncLoop();

    return () => {
      observer.disconnect();
      stopWatching();
      stopAlerts();
      cancelAnimationFrame(frame);
      window.clearInterval(ticker);
    };
  }, [liveRef]);

  return (
    <div
      ref={wrapRef}
      className="relative w-full"
      style={{ aspectRatio: `${liveRef.current.cols} / ${liveRef.current.rows}` }}
    >
      <canvas
        ref={canvasRef}
        className="h-full w-full rounded-[1.2rem]"
        aria-label="Snake game board"
      />
    </div>
  );
}

function facingFrom(from: Point | undefined, to: Point | undefined, fallback: Direction): Direction {
  if (!from || !to) return fallback;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (Math.abs(dx) < 0.01 && Math.abs(dy) < 0.01) return fallback;
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? "right" : "left";
  return dy > 0 ? "down" : "up";
}

function drawBoard(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  cols: number,
  rows: number,
  cell: number,
) {
  ctx.save();
  roundRect(ctx, 0, 0, width, height, 18);
  ctx.clip();

  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < cols; x += 1) {
      ctx.fillStyle = (x + y) % 2 === 0 ? COLORS.cellA : COLORS.cellB;
      ctx.fillRect(x * cell, y * cell, cell + 1, cell + 1);
    }
  }

  ctx.restore();
}

function drawEatFlash(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  now: number,
  ateAt: number,
) {
  if (!ateAt) return;
  const t = 1 - Math.min(1, (now - ateAt) / 220);
  if (t <= 0) return;
  ctx.fillStyle = `rgba(255, 248, 231, ${0.28 * t})`;
  roundRect(ctx, 0, 0, width, height, 18);
  ctx.fill();
}

function drawFoods(
  ctx: CanvasRenderingContext2D,
  foods: Food[],
  cell: number,
  now: number,
) {
  for (const food of foods) {
    drawFood(ctx, food, cell, now);
  }
}

function drawFood(
  ctx: CanvasRenderingContext2D,
  food: Food,
  cell: number,
  now: number,
) {
  const pulse = 0.94 + Math.sin(now / 200 + food.x * 1.7 + food.y * 2.1) * 0.06;
  const scale = 0.92 * pulse;
  const x = food.x * cell + cell / 2;
  const y = food.y * cell + cell / 2;

  ctx.fillStyle = food.kind === "golden" ? "rgba(249, 168, 37, 0.28)" : COLORS.foodGlow;
  ctx.beginPath();
  ctx.arc(x, y + cell * 0.04, cell * 0.28 * scale, 0, Math.PI * 2);
  ctx.fill();
  if (food.kind === "heart") drawHeart(ctx, x, y, cell * 0.9 * scale);
  else drawApple(ctx, x, y, cell * 0.92 * scale, food.kind === "golden");
}

function drawSnake(
  ctx: CanvasRenderingContext2D,
  points: Point[],
  cell: number,
  direction: Direction,
  now: number,
  ateAt: number,
  glowing: boolean,
) {
  if (points.length === 0) return;

  const eat = ateAt ? Math.max(0, 1 - (now - ateAt) / 180) : 0;
  const thickness = cell * (0.62 + eat * 0.04);
  const radius = cell * 0.48;
  const hue = (now / 12) % 360;
  const dark = glowing ? `hsl(${hue}, 70%, 32%)` : COLORS.snakeDark;
  const mid = glowing ? `hsl(${(hue + 40) % 360}, 72%, 48%)` : COLORS.snakeMid;
  const lite = glowing ? `hsl(${(hue + 80) % 360}, 80%, 72%)` : COLORS.snakeLite;

  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  traceSpine(ctx, points, cell, radius);
  ctx.strokeStyle = "rgba(42, 51, 36, 0.16)";
  ctx.lineWidth = thickness;
  ctx.stroke();
  ctx.translate(0, -1.5);
  traceSpine(ctx, points, cell, radius);
  ctx.strokeStyle = dark;
  ctx.lineWidth = thickness;
  ctx.stroke();
  ctx.strokeStyle = mid;
  ctx.lineWidth = thickness * 0.78;
  ctx.stroke();
  ctx.strokeStyle = lite;
  ctx.lineWidth = thickness * 0.22;
  ctx.stroke();
  ctx.restore();

  const head = points[0];
  drawFace(
    ctx,
    { x: head.x * cell + cell / 2, y: head.y * cell + cell / 2 },
    cell,
    direction,
    eat,
  );
}

function traceSpine(
  ctx: CanvasRenderingContext2D,
  points: Point[],
  cell: number,
  radius: number,
) {
  const x = (p: Point) => p.x * cell + cell / 2;
  const y = (p: Point) => p.y * cell + cell / 2;
  ctx.beginPath();
  ctx.moveTo(x(points[0]), y(points[0]));
  if (points.length === 1) return;
  if (points.length === 2) {
    ctx.lineTo(x(points[1]), y(points[1]));
    return;
  }
  for (let i = 1; i < points.length - 1; i += 1) {
    const prev = points[i - 1];
    const curr = points[i];
    const next = points[i + 1];
    const incoming = Math.hypot(curr.x - prev.x, curr.y - prev.y) * cell;
    const outgoing = Math.hypot(next.x - curr.x, next.y - curr.y) * cell;
    const rad = Math.min(radius, incoming * 0.49, outgoing * 0.49);
    ctx.arcTo(x(curr), y(curr), x(next), y(next), Math.max(0, rad));
  }
  const last = points[points.length - 1];
  ctx.lineTo(x(last), y(last));
}

function drawApple(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, golden = false) {
  const s = size / 32;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.fillStyle = "rgba(42, 51, 36, 0.16)";
  ctx.beginPath();
  ctx.ellipse(0, 14, 10, 3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = golden ? "#F57F17" : COLORS.foodDark;
  ctx.beginPath();
  ctx.arc(-4.5, 2.2, 11, 0, Math.PI * 2);
  ctx.arc(4.5, 2.2, 11, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = golden ? "#FDD835" : COLORS.food;
  ctx.beginPath();
  ctx.arc(-4.5, 0.4, 10, 0, Math.PI * 2);
  ctx.arc(4.5, 0.4, 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = golden ? "#FFF8E1" : "#FFCDD2";
  ctx.beginPath();
  ctx.ellipse(-6.5, -4, 3.1, 4.2, -0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#6D4C41";
  ctx.lineWidth = 2.2;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(0, -10);
  ctx.quadraticCurveTo(2, -16, 4, -18);
  ctx.stroke();
  ctx.fillStyle = "#7CB342";
  ctx.beginPath();
  ctx.ellipse(8, -14, 6.2, 3.1, 0.45, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawHeart(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
  const s = size / 28;
  ctx.save();
  ctx.translate(x, y + 1);
  ctx.scale(s, s);
  ctx.fillStyle = "rgba(42, 51, 36, 0.16)";
  ctx.beginPath();
  ctx.ellipse(0, 12, 9, 2.4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#AD1457";
  ctx.beginPath();
  ctx.moveTo(0, 10);
  ctx.bezierCurveTo(-16, 0, -10, -12, 0, -4);
  ctx.bezierCurveTo(10, -12, 16, 0, 0, 10);
  ctx.fill();
  ctx.fillStyle = "#F48FB1";
  ctx.beginPath();
  ctx.moveTo(0, 8);
  ctx.bezierCurveTo(-13, -1, -8, -10, 0, -2.4);
  ctx.bezierCurveTo(8, -10, 13, -1, 0, 8);
  ctx.fill();
  ctx.fillStyle = "#FFEBEE";
  ctx.beginPath();
  ctx.ellipse(-4, -4, 2.2, 1.4, -0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawFace(
  ctx: CanvasRenderingContext2D,
  head: Point,
  cell: number,
  direction: Direction,
  eat: number,
) {
  const forward = {
    up: { x: 0, y: -1 },
    down: { x: 0, y: 1 },
    left: { x: -1, y: 0 },
    right: { x: 1, y: 0 },
  }[direction];
  const side = { x: -forward.y, y: forward.x };
  const eye = cell * 0.15;
  const tongue = cell * (0.18 + eat * 0.12);

  ctx.fillStyle = COLORS.snakeDark;
  ctx.beginPath();
  ctx.arc(head.x, head.y, cell * 0.34, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = COLORS.snakeMid;
  ctx.beginPath();
  ctx.arc(head.x, head.y, cell * 0.27, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = COLORS.tongue;
  ctx.lineWidth = Math.max(2, cell * 0.075);
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(head.x + forward.x * cell * 0.28, head.y + forward.y * cell * 0.28);
  ctx.lineTo(
    head.x + forward.x * (cell * 0.28 + tongue),
    head.y + forward.y * (cell * 0.28 + tongue),
  );
  ctx.stroke();

  for (const sign of [-1, 1]) {
    const ex = head.x + forward.x * cell * 0.1 + side.x * eye * sign;
    const ey = head.y + forward.y * cell * 0.1 + side.y * eye * sign;
    ctx.fillStyle = COLORS.eye;
    ctx.beginPath();
    ctx.arc(ex, ey, cell * 0.09, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = COLORS.pupil;
    ctx.beginPath();
    ctx.arc(ex + forward.x * cell * 0.03, ey + forward.y * cell * 0.03, cell * 0.045, 0, Math.PI * 2);
    ctx.fill();
  }
}

function isMilestone(score: number) {
  if (score === 10 || score === 25 || score === 50) return true;
  return score >= 100 && score % 100 === 0;
}

function spawnBite(
  particles: Particle[],
  floaters: Floater[],
  head: Point,
  cell: number,
  canvas: HTMLCanvasElement,
  score: number,
  pendingGrow: number,
) {
  const x = head.x * cell + cell / 2;
  const y = head.y * cell + cell / 2;
  floaters.push({ x, y, life: 0, max: 520, text: pendingGrow >= 2 ? "+3" : "+1" });

  for (let i = 0; i < 12; i += 1) {
    const angle = (Math.PI * 2 * i) / 12 + Math.random() * 0.4;
    const speed = 0.06 + Math.random() * 0.09;
    particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed * cell,
      vy: Math.sin(angle) * speed * cell,
      life: 0,
      max: 280 + Math.random() * 180,
      size: 1.6 + Math.random() * 2.4,
      color: i % 2 === 0 ? COLORS.food : COLORS.snakeLite,
    });
  }

  if (!isMilestone(score)) return;

  const rect = canvas.getBoundingClientRect();
  confetti({
    particleCount: 72,
    spread: 70,
    startVelocity: 34,
    gravity: 0.85,
    ticks: 180,
    origin: {
      x: (rect.left + rect.width / 2) / window.innerWidth,
      y: (rect.top + rect.height / 2) / window.innerHeight,
    },
    colors: ["#E53935", "#43A047", "#F9A825", "#FFF8E7"],
  });
}

function stepFx(particles: Particle[], floaters: Floater[], dt: number) {
  for (const particle of particles) {
    particle.life += dt;
    particle.x += particle.vx * (dt / 16);
    particle.y += particle.vy * (dt / 16);
    particle.vy += 0.012 * dt;
  }
  for (const floater of floaters) {
    floater.life += dt;
    floater.y -= 0.045 * dt;
  }
  prune(particles);
  prune(floaters);
}

function prune<T extends { life: number; max: number }>(items: T[]) {
  for (let i = items.length - 1; i >= 0; i -= 1) {
    if (items[i].life >= items[i].max) items.splice(i, 1);
  }
}

function drawFx(
  ctx: CanvasRenderingContext2D,
  particles: Particle[],
  floaters: Floater[],
  cell: number,
) {
  for (const particle of particles) {
    const t = 1 - particle.life / particle.max;
    ctx.globalAlpha = Math.max(0, t);
    ctx.fillStyle = particle.color;
    ctx.beginPath();
    ctx.arc(particle.x, particle.y, particle.size * t, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  ctx.font = `400 ${Math.max(10, cell * 0.28)}px "Press Start 2P", monospace`;
  ctx.textAlign = "center";
  for (const floater of floaters) {
    const t = 1 - floater.life / floater.max;
    ctx.globalAlpha = Math.max(0, t);
    ctx.fillStyle = "#2A3324";
    ctx.fillText(floater.text, floater.x, floater.y);
  }
  ctx.globalAlpha = 1;
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}
