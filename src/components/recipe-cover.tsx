import Image from "next/image";
import type { SanityImageSource } from "@sanity/image-url";
import { urlForImage } from "@/sanity/lib/image";
import { PawMark } from "@/components/paw-mark";

export function RecipeCover({
  image,
  title,
  className,
  sizes = "(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw",
}: {
  image?: SanityImageSource | null;
  title: string;
  className?: string;
  /** Rendered width hint for next/image so it doesn't over-fetch. */
  sizes?: string;
}) {
  if (!image) {
    return (
      <div
        className={`flex h-full flex-col items-center justify-center gap-3 bg-paper-sunk px-5 text-center ${className ?? ""}`}
      >
        <PawMark className="h-6 w-6 text-clay" />
        <span className="editorial-display text-2xl leading-tight text-terracotta">
          {title}
        </span>
      </div>
    );
  }
  return (
    <Image
      src={urlForImage(image).width(800).height(600).fit("crop").auto("format").url()}
      alt={title}
      width={800}
      height={600}
      sizes={sizes}
      className={`h-full w-full object-cover ${className ?? ""}`}
    />
  );
}
