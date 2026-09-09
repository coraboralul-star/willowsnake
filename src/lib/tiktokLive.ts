"use client";

import { emitLiveGift, emitLiveLike, type LiveGift, type LiveLike } from "@/lib/gifts";

export type TikTokLiveHandle = {
  disconnect: () => void;
};

export type TikTokBridgeStatus = {
  connected: boolean;
  uniqueId?: string;
  message: string;
};

const BRIDGE_HTTP = "http://127.0.0.1:8787";
const BRIDGE_WS = "ws://127.0.0.1:8787";

type BridgeGift = LiveGift & { type?: string };
type BridgeLike = LiveLike & { type?: string };

export function connectTikTokLive(options: {
  onGift?: (gift: LiveGift) => void;
  onLike?: (like: LiveLike) => void;
  onStatus?: (status: TikTokBridgeStatus) => void;
} = {}): TikTokLiveHandle {
  const onGift = options.onGift ?? emitLiveGift;
  const onLike = options.onLike ?? emitLiveLike;
  const onStatus = options.onStatus;
  const seen = new Set<string>();
  let closed = false;
  let socket: WebSocket | null = null;
  let retry: number | null = null;
  let poller: number | null = null;

  const remember = (id: string) => {
    if (seen.has(id)) return false;
    seen.add(id);
    if (seen.size > 400) seen.clear();
    return true;
  };

  const takeGift = (gift: BridgeGift) => {
    if (!gift.id || !gift.user || !gift.coins) return;
    if (!remember(gift.id)) return;
    onGift({
      id: gift.id,
      user: gift.user,
      coins: gift.coins,
      count: gift.count ?? 1,
      avatar: gift.avatar,
      uniqueId: gift.uniqueId,
    });
  };

  const takeLike = (like: BridgeLike) => {
    if (!like.id || !like.user) return;
    if (!remember(like.id)) return;
    onLike({
      id: like.id,
      user: like.user,
      likes: Math.max(1, like.likes || 1),
      avatar: like.avatar,
      uniqueId: like.uniqueId,
    });
  };

  const openSocket = () => {
    if (closed) return;
    socket = new WebSocket(BRIDGE_WS);
    socket.onopen = () => {
      onStatus?.({ connected: false, message: "Bridge connected, waiting for LIVE…" });
    };
    socket.onmessage = (event) => {
      try {
        const payload = JSON.parse(String(event.data)) as {
          type?: string;
          uniqueId?: string;
          connected?: boolean;
          message?: string;
        } & BridgeGift & BridgeLike;
        if (payload.type === "status") {
          onStatus?.({
            connected: Boolean(payload.connected),
            uniqueId: payload.uniqueId,
            message: payload.message ?? "",
          });
          return;
        }
        if (payload.type === "gift") takeGift(payload);
        if (payload.type === "like") takeLike(payload);
      } catch {
        // Ignore malformed bridge frames.
      }
    };
    socket.onclose = () => {
      if (closed) return;
      onStatus?.({
        connected: false,
        message: "Open http://localhost:3000 and keep npm run tiktok running",
      });
      retry = window.setTimeout(openSocket, 2000);
    };
    socket.onerror = () => {
      socket?.close();
    };
  };

  const poll = async () => {
    if (closed) return;
    try {
      const res = await fetch(`${BRIDGE_HTTP}/poll`, { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as {
        connected?: boolean;
        uniqueId?: string;
        message?: string;
        gifts?: BridgeGift[];
        likes?: BridgeLike[];
      };
      onStatus?.({
        connected: Boolean(data.connected),
        uniqueId: data.uniqueId,
        message: data.message ?? (data.connected ? "Listening" : "Waiting for LIVE"),
      });
      for (const gift of data.gifts ?? []) takeGift(gift);
      for (const like of data.likes ?? []) takeLike(like);
    } catch {
      // Bridge is down; socket retry will keep trying.
    }
  };

  openSocket();
  void poll();
  poller = window.setInterval(() => {
    void poll();
  }, 500);

  return {
    disconnect: () => {
      closed = true;
      if (retry != null) window.clearTimeout(retry);
      if (poller != null) window.clearInterval(poller);
      socket?.close();
    },
  };
}
