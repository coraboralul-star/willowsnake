"use client";

import { useEffect, useState } from "react";
import {
  matchGifters,
  matchLikers,
  onMatchFeed,
  type MatchViewer,
} from "@/lib/matchFeed";

export function MatchRecap() {
  const [gifters, setGifters] = useState(matchGifters);
  const [likers, setLikers] = useState(matchLikers);

  useEffect(() => {
    const sync = () => {
      setGifters(matchGifters());
      setLikers(matchLikers());
    };
    sync();
    return onMatchFeed(sync);
  }, []);

  return (
    <div className="mt-4 grid w-full max-w-[22rem] grid-cols-2 gap-2 text-left">
      <RankColumn title="Gifters" rows={gifters} value={(row) => row.coins} unit="coins" />
      <RankColumn title="Likes" rows={likers} value={(row) => row.likes} unit="likes" />
    </div>
  );
}

function RankColumn({
  title,
  rows,
  value,
  unit,
}: {
  title: string;
  rows: MatchViewer[];
  value: (row: MatchViewer) => number;
  unit: string;
}) {
  return (
    <div className="rounded-xl bg-cream/90 px-2 py-2 shadow-soft">
      <p className="mb-1.5 text-center text-[0.58rem] font-extrabold uppercase tracking-[0.14em] text-ink-soft">
        {title}
      </p>
      <div className="flex max-h-40 flex-col gap-1 overflow-y-auto">
        {rows.length === 0 ? (
          <p className="py-3 text-center text-[0.65rem] text-ink-soft">None yet</p>
        ) : (
          rows.slice(0, 8).map((row, index) => (
            <div key={row.id} className="flex items-center gap-1.5">
              <span className="w-3 shrink-0 text-center font-display text-[0.7rem] text-ink-soft">
                {index + 1}
              </span>
              <Avatar user={row.user} src={row.avatar} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-display text-[0.7rem] leading-tight text-ink">{row.user}</p>
                <p className="text-[0.55rem] font-extrabold uppercase tracking-wide text-ink-soft">
                  {value(row)} {unit}
                </p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function Avatar({ user, src }: { user: string; src?: string }) {
  const initial = user.trim().slice(0, 1).toUpperCase() || "?";
  return (
    <span className="relative h-6 w-6 shrink-0 overflow-hidden rounded-full bg-sage-deep/20 text-center font-display text-[0.7rem] leading-6 text-sage-deep">
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          referrerPolicy="no-referrer"
          className="h-full w-full object-cover"
        />
      ) : (
        initial
      )}
    </span>
  );
}
