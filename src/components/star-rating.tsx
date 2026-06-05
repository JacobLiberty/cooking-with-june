/**
 * Read-only star rating, 0–5 in half steps. Uses the deep-amber `star` token
 * (AA-contrast; the brighter ochre failed contrast as the carrier of rating info).
 * Renders 5 star glyphs (full / half / empty) and an accessible label.
 */
export function Star({
  fill,
  index,
  className = "h-4 w-4",
}: {
  fill: "full" | "half" | "empty";
  index: number;
  className?: string;
}) {
  const id = `half-star-${index}`;
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      {fill === "half" ? (
        <defs>
          <linearGradient id={id}>
            <stop offset="50%" stopColor="currentColor" />
            <stop offset="50%" stopColor="transparent" />
          </linearGradient>
        </defs>
      ) : null}
      <path
        d="M12 2.5l2.9 5.88 6.49.94-4.7 4.58 1.11 6.46L12 17.9l-5.8 3.05 1.11-6.46-4.7-4.58 6.49-.94L12 2.5z"
        fill={
          fill === "full"
            ? "currentColor"
            : fill === "half"
              ? `url(#${id})`
              : "none"
        }
        stroke="currentColor"
        strokeWidth="1.2"
      />
    </svg>
  );
}

export function StarRating({
  value,
  className,
}: {
  value: number;
  className?: string;
}) {
  const stars = Array.from({ length: 5 }, (_, i) => {
    if (value >= i + 1) return "full" as const;
    if (value >= i + 0.5) return "half" as const;
    return "empty" as const;
  });
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-star ${className ?? ""}`}
      role="img"
      aria-label={`${value} out of 5 stars`}
    >
      {stars.map((fill, i) => (
        <Star key={i} fill={fill} index={i} />
      ))}
    </span>
  );
}
