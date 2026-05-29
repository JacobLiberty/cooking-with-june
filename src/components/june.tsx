/** Minimal line-art June — inherits color via currentColor. Decorative. */
export function JunePeek({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 80 34" className={className} aria-hidden fill="none">
      {/* ears */}
      <path d="M20 14 L15 3 L29 9 Z" fill="currentColor" />
      <path d="M60 14 L65 3 L51 9 Z" fill="currentColor" />
      {/* head dome rising over the baseline */}
      <path
        d="M12 34 C12 18 24 9 40 9 C56 9 68 18 68 34"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      {/* eyes */}
      <circle cx="32" cy="22" r="2.4" fill="currentColor" />
      <circle cx="48" cy="22" r="2.4" fill="currentColor" />
      {/* nose + whiskers */}
      <path d="M40 26 l-2.5 2 M40 26 l2.5 2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M30 28 l-9 -1 M30 30 l-9 2 M50 28 l9 -1 M50 30 l9 2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity="0.7" />
    </svg>
  );
}

export function JuneCurled({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 80" className={className} aria-hidden fill="none">
      {/* curled body */}
      <path
        d="M18 56 C12 30 40 16 66 22 C92 28 104 50 92 64 C82 75 40 76 30 64"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      {/* ear */}
      <path d="M60 22 L58 10 L70 17 Z" fill="currentColor" />
      {/* tail curl */}
      <path d="M92 64 C104 64 110 52 100 46" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
      {/* closed sleepy eye */}
      <path d="M64 34 q4 4 9 0" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
