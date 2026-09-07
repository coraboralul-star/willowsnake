"use client";

import { useEffect, useState } from "react";
import { onLiveAlert, type LiveAlert } from "@/lib/gifts";

export function GiftToasts() {
  const [alerts, setAlerts] = useState<LiveAlert[]>([]);

  useEffect(() => {
    return onLiveAlert((alert) => {
      setAlerts((current) => [...current.slice(-2), alert]);
      window.setTimeout(() => {
        setAlerts((current) => current.filter((item) => item.id !== alert.id));
      }, 2800);
    });
  }, []);

  if (alerts.length === 0) return null;

  return (
    <div className="pointer-events-none absolute inset-x-3 top-3 z-20 flex flex-col items-center gap-2">
      {alerts.map((alert) => (
        <p
          key={alert.id}
          className={`rounded-full px-3 py-1.5 font-display text-sm shadow-soft ${toneClass(alert.tone)}`}
        >
          {alert.user}
          <span className="mx-1.5 opacity-50">·</span>
          {alert.label}
        </p>
      ))}
    </div>
  );
}

function toneClass(tone: LiveAlert["tone"]) {
  if (tone === "golden") return "bg-[#F9A825] text-[#3E2A00]";
  if (tone === "nitro") return "bg-[#29B6F6] text-[#083344]";
  if (tone === "hearts") return "bg-[#F48FB1] text-[#4A1530]";
  if (tone === "rain") return "bg-[#E53935] text-cream";
  return "bg-cream text-ink";
}
