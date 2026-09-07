import { config } from "dotenv";
import { createServer } from "http";
import { TikTokLiveConnection, UserOfflineError, WebcastEvent } from "tiktok-live-connector";
import { WebSocketServer, type WebSocket } from "ws";

config({ path: ".env.local" });
config();

const uniqueId = (process.env.TIKTOK_UNIQUE_ID ?? "").replace(/^@/, "").trim();
const apiKey = (process.env.EULER_API_KEY ?? "").trim();
const port = Number(process.env.TIKTOK_BRIDGE_PORT ?? 8787);

if (!uniqueId) {
  console.error("Missing TIKTOK_UNIQUE_ID in .env.local");
  process.exit(1);
}
if (!apiKey) {
  console.error("Missing EULER_API_KEY in .env.local");
  process.exit(1);
}

const sockets = new Set<WebSocket>();
const recent: Array<{
  type: "gift";
  id: string;
  user: string;
  coins: number;
  count: number;
}> = [];

function broadcast(payload: unknown) {
  const raw = JSON.stringify(payload);
  for (const socket of sockets) {
    if (socket.readyState === socket.OPEN) socket.send(raw);
  }
}

function mapGift(data: Record<string, unknown>) {
  const details = (data.giftDetails ?? data.gift ?? {}) as Record<string, unknown>;
  const user = (data.user ?? {}) as Record<string, unknown>;
  const giftType = Number(details.giftType ?? data.giftType ?? details.gift_type ?? 0);
  const repeatEnd = Boolean(data.repeatEnd ?? data.repeat_end);
  if (giftType === 1 && !repeatEnd) return null;

  const coins = Number(data.diamondCount ?? details.diamondCount ?? details.diamond_count ?? 0);
  const count = Math.max(1, Number(data.repeatCount ?? data.repeat_count ?? 1));
  if (coins <= 0) return null;

  const name = String(user.nickname || user.uniqueId || user.unique_id || "Viewer");
  return {
    type: "gift" as const,
    id: `${name}-${coins}-${count}-${Date.now()}`,
    user: name,
    coins,
    count,
  };
}

const httpServer = createServer();
const wss = new WebSocketServer({ server: httpServer });

wss.on("connection", (socket) => {
  sockets.add(socket);
  console.log(`Game overlay connected (${sockets.size})`);
  socket.send(
    JSON.stringify({
      type: "status",
      uniqueId,
      connected: liveConnected,
      message: liveConnected ? `Listening to @${uniqueId}` : `Waiting for @${uniqueId} to go LIVE`,
    }),
  );
  socket.on("close", () => {
    sockets.delete(socket);
    console.log(`Game overlay disconnected (${sockets.size})`);
  });
});

httpServer.on("request", (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Content-Type", "application/json");
  if (req.url?.startsWith("/poll")) {
    res.end(
      JSON.stringify({
        connected: liveConnected,
        uniqueId,
        message: liveConnected ? `Listening to @${uniqueId}` : `Waiting for @${uniqueId} to go LIVE`,
        gifts: recent,
      }),
    );
    return;
  }
  res.end(JSON.stringify({ ok: true, clients: sockets.size, connected: liveConnected }));
});

let liveConnected = false;
let joining = false;
const connection = new TikTokLiveConnection(uniqueId, { signApiKey: apiKey });

connection.on(WebcastEvent.GIFT, (data) => {
  const gift = mapGift(data as unknown as Record<string, unknown>);
  if (!gift) return;
  console.log(`Gift: ${gift.user} · ${gift.count}× ${gift.coins} coin`);
  recent.push(gift);
  if (recent.length > 50) recent.shift();
  if (sockets.size === 0) {
    console.log("No game overlay connected. Open http://localhost:3000 in the captured browser.");
  } else {
    console.log(`Sending to ${sockets.size} overlay(s)`);
  }
  broadcast(gift);
});

function onDropped() {
  if (!liveConnected) return;
  liveConnected = false;
  broadcast({
    type: "status",
    uniqueId,
    connected: false,
    message: "TikTok dropped, retrying…",
  });
  void connectLive();
}

connection.on("disconnected" as never, onDropped);
connection.on("streamEnd" as never, onDropped);

async function connectLive() {
  if (joining) return;
  joining = true;
  try {
    while (true) {
      try {
        broadcast({
          type: "status",
          uniqueId,
          connected: false,
          message: `Waiting for @${uniqueId} to go LIVE`,
        });
        await connection.connect();
        liveConnected = true;
        console.log(`Connected to @${uniqueId}`);
        broadcast({
          type: "status",
          uniqueId,
          connected: true,
          message: `Listening to @${uniqueId}`,
        });
        return;
      } catch (error) {
        liveConnected = false;
        const offline = error instanceof UserOfflineError;
        console.log(offline ? `@${uniqueId} is not live yet` : "TikTok connect failed, retrying…");
        await new Promise((resolve) => setTimeout(resolve, 8000));
      }
    }
  } finally {
    joining = false;
  }
}

httpServer.listen(port, "127.0.0.1", () => {
  console.log(`Gift bridge on ws://127.0.0.1:${port}`);
  console.log(`Watching @${uniqueId}`);
  void connectLive();
});
