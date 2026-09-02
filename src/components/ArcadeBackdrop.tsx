"use client";

export function ArcadeBackdrop() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute inset-0 bg-gingham" />
      <div className="absolute inset-0 bg-arcade-glow" />
      <svg className="absolute inset-0 h-full w-full" aria-hidden="true">
        <defs>
          <pattern id="dots" width="36" height="36" patternUnits="userSpaceOnUse">
            <circle cx="4" cy="4" r="1.15" fill="#2e7d32" opacity="0.18" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#dots)" />
      </svg>
      <Doodle className="left-[5%] top-[16%] w-16 opacity-55" rotate={-8} />
      <Doodle className="right-[6%] top-[20%] w-14 opacity-70" rotate={12} apple />
      <Doodle className="bottom-[18%] left-[10%] w-12 opacity-65" rotate={6} apple />
      <Doodle className="bottom-[14%] right-[8%] w-20 opacity-50" rotate={-4} />
      <Doodle className="left-[20%] top-[7%] w-10 opacity-45" rotate={16} apple />
      <Doodle className="right-[22%] bottom-[7%] w-10 opacity-45" rotate={-14} />
      <div className="absolute left-[8%] top-[18%] h-16 w-16 rounded-full bg-[#43A047]/20 blur-2xl" />
      <div className="absolute right-[10%] top-[12%] h-24 w-24 rounded-full bg-[#E53935]/15 blur-2xl" />
      <div className="absolute bottom-[12%] left-[20%] h-20 w-20 rounded-full bg-[#F9A825]/20 blur-2xl" />
    </div>
  );
}

function Doodle({
  className,
  rotate = 0,
  apple = false,
}: {
  className: string;
  rotate?: number;
  apple?: boolean;
}) {
  return (
    <svg
      viewBox="0 0 64 64"
      className={`absolute ${className}`}
      style={{ transform: `rotate(${rotate}deg)` }}
    >
      {apple ? (
        <>
          <circle cx="28" cy="36" r="14" fill="#E53935" opacity="0.85" />
          <circle cx="36" cy="36" r="14" fill="#E53935" opacity="0.85" />
          <path d="M32 22v-8" stroke="#6D4C41" strokeWidth="3" strokeLinecap="round" />
          <path d="M32 16c8-2 10 4 8 8" stroke="#7CB342" strokeWidth="3" strokeLinecap="round" />
        </>
      ) : (
        <>
          <path
            d="M10 44h18v-18h18"
            stroke="#43A047"
            strokeWidth="8"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity="0.55"
          />
          <circle cx="46" cy="26" r="7" fill="#43A047" opacity="0.7" />
        </>
      )}
    </svg>
  );
}
