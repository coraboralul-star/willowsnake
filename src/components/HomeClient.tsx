"use client";

import { useCallback, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArcadeBackdrop } from "@/components/ArcadeBackdrop";
import { GameApp } from "@/components/GameApp";
import { Loader } from "@/components/Loader";

export function HomeClient() {
  const [ready, setReady] = useState(false);
  const onDone = useCallback(() => setReady(true), []);

  return (
    <main className="relative flex min-h-dvh flex-col items-center overflow-x-hidden px-5 py-4 sm:px-8 sm:py-6">
      <ArcadeBackdrop />
      <AnimatePresence>{!ready && <Loader key="loader" onDone={onDone} />}</AnimatePresence>
      <motion.div
        className="relative z-10 mx-auto w-full max-w-6xl"
        initial={false}
        animate={{ opacity: ready ? 1 : 0, y: ready ? 0 : 10 }}
        transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
      >
        <GameApp enabled={ready} />
      </motion.div>
    </main>
  );
}
