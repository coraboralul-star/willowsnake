"use client";

let audio: AudioContext | null = null;

function context() {
  if (typeof window === "undefined") return null;
  if (!audio) audio = new AudioContext();
  if (audio.state === "suspended") void audio.resume();
  return audio;
}

export function playEat() {
  const ac = context();
  if (!ac) return;

  const now = ac.currentTime;
  const hop = (freq: number, start: number, dur: number, volume: number) => {
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(freq, now + start);
    osc.frequency.exponentialRampToValueAtTime(freq * 1.45, now + start + dur);
    gain.gain.setValueAtTime(0.0001, now + start);
    gain.gain.exponentialRampToValueAtTime(volume, now + start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + start + dur);
    osc.connect(gain);
    gain.connect(ac.destination);
    osc.start(now + start);
    osc.stop(now + start + dur + 0.02);
  };

  hop(380, 0, 0.08, 0.06);
  hop(560, 0.055, 0.09, 0.05);
}

export function playBonk() {
  const ac = context();
  if (!ac) return;

  const now = ac.currentTime;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(180, now);
  osc.frequency.exponentialRampToValueAtTime(70, now + 0.16);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.08, now + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
  osc.connect(gain);
  gain.connect(ac.destination);
  osc.start(now);
  osc.stop(now + 0.2);
}
