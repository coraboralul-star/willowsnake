"use client";

import { useEffect, useState } from "react";
import { onLiveAlert, type LiveAlert } from "@/lib/gifts";

export function GiftToasts() {
  const [alerts, setAlerts] = useState<LiveAlert[]>([]);

  useEffect(() => {
    return onLiveAlert((alert) => {
      setAlerts((current) => [...current.slice(-4), alert]);
      window.setTimeout(() => {
        setAlerts((current) => current.filter((item) => item.id !== alert.id));
      }, 4200);
    });
  }, []);

  return (
    <div className="flex min-h-[168px] w-full flex-col items-stretch justify-center gap-2">
      {alerts.map((alert) => (
        <p
          key={alert.id}
          className={`rounded-xl px-2.5 py-2 text-center shadow-soft ${toneClass(alert.tone)}`}
        >
          <span className="block font-display text-sm leading-tight">{alert.user}</span>
          <span className="mt-0.5 block text-[0.62rem] font-extrabold uppercase tracking-[0.12em] opacity-80">
            {alert.label}
          </span>
        </p>
      ))}
    </div>
  );
}

function toneClass(tone: LiveAlert["tone"]) {
  if (tone === "golden") return "bg-[#F9A825] text-[#3E2A00]";
  if (tone === "nitro") return "bg-[#29B6F6] text-[#083344]";
  if (tone === "rain") return "bg-[#E53935] text-cream";
  return "bg-cream text-ink";
}
