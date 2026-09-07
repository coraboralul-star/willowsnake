export function SnakeMascot({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 240 140"
      className={className}
      aria-hidden="true"
      fill="none"
    >
      <ellipse cx="120" cy="126" rx="78" ry="8" fill="#2a3324" opacity="0.12" />
      <path
        d="M22 92c12-38 38-38 52 0s34 36 52 0 34-36 52 0c10 20 22 28 40 10"
        stroke="#1B5E20"
        strokeWidth="26"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M22 92c12-38 38-38 52 0s34 36 52 0 34-36 52 0c10 20 22 28 40 10"
        stroke="#43A047"
        strokeWidth="18"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M36 90c8-24 26-24 36 0s24 24 36 0 24-24 36 0"
        stroke="#C8E6C9"
        strokeWidth="4"
        strokeLinecap="round"
        opacity="0.7"
      />
      <circle cx="206" cy="68" r="22" fill="#1B5E20" />
      <circle cx="206" cy="68" r="17" fill="#43A047" />
      <circle cx="198" cy="62" r="5.4" fill="#F8FFF4" />
      <circle cx="214" cy="62" r="5.4" fill="#F8FFF4" />
      <circle cx="199.4" cy="62.6" r="2.4" fill="#1A2A18" />
      <circle cx="215.4" cy="62.6" r="2.4" fill="#1A2A18" />
      <circle cx="197.6" cy="61.4" r="1" fill="#FFFFFF" />
      <circle cx="213.6" cy="61.4" r="1" fill="#FFFFFF" />
      <circle cx="200" cy="74" r="3.2" fill="#F48FB1" opacity="0.85" />
      <circle cx="214" cy="74" r="3.2" fill="#F48FB1" opacity="0.85" />
      <path d="M222 74h14" stroke="#E53935" strokeWidth="3.2" strokeLinecap="round" />
      <path d="M234 74c3 4 3 8 0 10" stroke="#E53935" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}

export function PixelApple({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <ellipse cx="16" cy="28" rx="8" ry="2.2" fill="#2a3324" opacity="0.16" />
      <circle cx="12.5" cy="18" r="9" fill="#B71C1C" />
      <circle cx="19.5" cy="18" r="9" fill="#B71C1C" />
      <circle cx="12.5" cy="17" r="8" fill="#E53935" />
      <circle cx="19.5" cy="17" r="8" fill="#E53935" />
      <circle cx="12" cy="13.5" r="2.4" fill="#FFCDD2" />
      <path d="M16 10v-5" stroke="#6D4C41" strokeWidth="2.2" strokeLinecap="round" />
      <path
        d="M16 7c5-1.4 7.4 2.4 6.2 5"
        stroke="#7CB342"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function PixelSkull({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <ellipse cx="16" cy="28" rx="8" ry="2.2" fill="#2a3324" opacity="0.16" />
      <path
        d="M8 14c0-6 3.6-10 8-10s8 4 8 10v6c0 1.2-.6 2-1.6 2h-1.2v2.4c0 .8-.6 1.4-1.4 1.4h-1.6c-.8 0-1.4-.6-1.4-1.4V22h-1.6v2.4c0 .8-.6 1.4-1.4 1.4h-1.6c-.8 0-1.4-.6-1.4-1.4V22H9.6C8.6 22 8 21.2 8 20v-6Z"
        fill="#F4E7C8"
        stroke="#3E3424"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <circle cx="12.4" cy="15.2" r="2.3" fill="#1A2A18" />
      <circle cx="19.6" cy="15.2" r="2.3" fill="#1A2A18" />
      <circle cx="11.7" cy="14.6" r="0.7" fill="#FFF8E7" />
      <circle cx="18.9" cy="14.6" r="0.7" fill="#FFF8E7" />
      <path d="M16 18.2 14.6 21h2.8L16 18.2Z" fill="#3E3424" />
      <path d="M11.5 23.6h2.2M14.9 23.6h2.2M18.3 23.6h2.2" stroke="#3E3424" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}
