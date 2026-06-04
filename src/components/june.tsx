import Image from "next/image";

export type JunePose =
  | "head"
  | "peek"
  | "loaf"
  | "sleeping"
  | "divider"
  | "bat";

const POSES: Record<
  JunePose,
  { src: string; w: number; h: number; alt: string }
> = {
  head: { src: "/june/june-head.png", w: 320, h: 320, alt: "June, our brown tabby" },
  peek: {
    src: "/june/june-peek.png",
    w: 560,
    h: 335,
    alt: "June peeking over in a chef's hat",
  },
  loaf: {
    src: "/june/june-loaf.png",
    w: 480,
    h: 377,
    alt: "June sitting and supervising",
  },
  sleeping: {
    src: "/june/june-sleeping.png",
    w: 500,
    h: 371,
    alt: "June curled up asleep",
  },
  // decorative-only divider
  divider: { src: "/june/june-divider.png", w: 720, h: 256, alt: "" },
  bat: {
    src: "/june/june-404.png",
    w: 464,
    h: 480,
    alt: "June batting something off the counter",
  },
};

/**
 * June mascot artwork (kawaii chibi PNGs). Pass a `pose`; size with `className`
 * (set one dimension + `h-auto`/`w-auto` to keep the aspect ratio).
 */
export function JuneArt({
  pose,
  className,
  priority,
}: {
  pose: JunePose;
  className?: string;
  priority?: boolean;
}) {
  const p = POSES[pose];
  return (
    <Image
      src={p.src}
      alt={p.alt}
      width={p.w}
      height={p.h}
      priority={priority}
      aria-hidden={p.alt === "" ? true : undefined}
      className={className}
    />
  );
}
