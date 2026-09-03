"use client";

export function isPageVisible() {
  return typeof document === "undefined" || !document.hidden;
}

export function onPageVisibility(callback: (visible: boolean) => void) {
  if (typeof document === "undefined") return () => {};

  const onChange = () => callback(!document.hidden);
  document.addEventListener("visibilitychange", onChange);
  return () => document.removeEventListener("visibilitychange", onChange);
}
