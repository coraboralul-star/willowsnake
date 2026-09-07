"use client";

import { emitLiveGift, type LiveGift } from "@/lib/gifts";

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

export function connectTikTokLive(options: {
  onGift?: (gift: LiveGift) => void;
  onStatus?: (status: TikTokBridgeStatus) => void;
} = {}): TikTokLiveHandle {
  const onGift = options.onGift ?? emitLiveGift;
  const onStatus = options.onStatus;
  const seen = new Set<string>();
  let closed = false;
  let socket: WebSocket | null = null;
  let retry: number | null = null;
  let poller: number | null = null;

  const takeGift = (gift: BridgeGift) => {
    if (!gift.id || !gift.user || !gift.coins) return;
    if (seen.has(gift.id)) return;
    seen.add(gift.id);
    if (seen.size > 200) seen.clear();
    onGift({
      id: gift.id,
      user: gift.user,
      coins: gift.coins,
      count: gift.count ?? 1,
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
        } & BridgeGift;
        if (payload.type === "status") {
          onStatus?.({
            connected: Boolean(payload.connected),
            uniqueId: payload.uniqueId,
            message: payload.message ?? "",
          });
          return;
        }
        if (payload.type === "gift") takeGift(payload);
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
      };
      onStatus?.({
        connected: Boolean(data.connected),
        uniqueId: data.uniqueId,
        message: data.message ?? (data.connected ? "Listening" : "Waiting for LIVE"),
      });
      for (const gift of data.gifts ?? []) takeGift(gift);
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
