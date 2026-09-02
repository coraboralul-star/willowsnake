"use client";

import { useEffect } from "react";
import { motion } from "motion/react";
import { PixelApple, SnakeMascot } from "@/components/SnakeMascot";

type LoaderProps = {
  onDone: () => void;
};

export function Loader({ onDone }: LoaderProps) {
  useEffect(() => {
    let cancelled = false;
    const minimum = new Promise((resolve) => window.setTimeout(resolve, 1250));
    const fonts = document.fonts?.ready ?? Promise.resolve();

    void Promise.all([minimum, fonts]).then(() => {
      if (!cancelled) onDone();
    });

    return () => {
      cancelled = true;
    };
  }, [onDone]);

  return (
    <motion.div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-parchment"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, filter: "blur(8px)" }}
      transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="flex flex-col items-center gap-5">
        <motion.div
          initial={{ scale: 0.92, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          className="flex items-end gap-2"
        >
          <SnakeMascot className="h-28 w-52" />
          <PixelApple className="mb-4 h-12 w-12" />
        </motion.div>
        <div className="text-center">
          <p className="font-display text-2xl text-ink">WILLOW</p>
          <p className="mt-3 font-display text-[0.55rem] tracking-[0.28em] text-ink-soft">
            ARCADE SNAKE
          </p>
        </div>
      </div>
    </motion.div>
  );
}
