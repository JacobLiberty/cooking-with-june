/**
 * June's pawprint — a small, custom line-art mark used as a quiet recurring
 * ornament (masthead, footer, "made it" stamp). Inherits color via currentColor.
 * Decorative by default; pass a `title` to make it meaningful to assistive tech.
 */
export function PawMark({
  className,
  title,
  style,
}: {
  className?: string;
  title?: string;
  style?: React.CSSProperties;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      style={style}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      {title ? <title>{title}</title> : null}
      <ellipse cx="12" cy="15.6" rx="4.3" ry="3.7" />
      <ellipse cx="6.2" cy="10.9" rx="1.95" ry="2.5" />
      <ellipse cx="10" cy="7.5" rx="1.95" ry="2.5" />
      <ellipse cx="14" cy="7.5" rx="1.95" ry="2.5" />
      <ellipse cx="17.8" cy="10.9" rx="1.95" ry="2.5" />
    </svg>
  );
}
