"use client";

export type MatchViewer = {
  id: string;
  user: string;
  avatar?: string;
  coins: number;
  likes: number;
};

type Listener = () => void;

let gifters: MatchViewer[] = [];
let likers: MatchViewer[] = [];
const listeners = new Set<Listener>();

function bump(list: MatchViewer[], entry: Omit<MatchViewer, "coins" | "likes"> & { coins?: number; likes?: number }) {
  const id = entry.id || entry.user;
  const current = list.find((row) => row.id === id);
  if (current) {
    current.coins += entry.coins ?? 0;
    current.likes += entry.likes ?? 0;
    if (entry.avatar) current.avatar = entry.avatar;
    if (entry.user) current.user = entry.user;
    return;
  }
  list.push({
    id,
    user: entry.user,
    avatar: entry.avatar,
    coins: entry.coins ?? 0,
    likes: entry.likes ?? 0,
  });
}

function emit() {
  for (const listener of listeners) listener();
}

export function resetMatchFeed() {
  gifters = [];
  likers = [];
  emit();
}

export function recordMatchGift(user: string, coins: number, avatar?: string, id?: string) {
  bump(gifters, { id: id || user, user, avatar, coins });
  emit();
}

export function recordMatchLike(user: string, likes: number, avatar?: string, id?: string) {
  bump(likers, { id: id || user, user, avatar, likes });
  emit();
}

export function matchGifters() {
  return gifters.slice().sort((a, b) => b.coins - a.coins || a.user.localeCompare(b.user));
}

export function matchLikers() {
  return likers.slice().sort((a, b) => b.likes - a.likes || a.user.localeCompare(b.user));
}

export function onMatchFeed(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
