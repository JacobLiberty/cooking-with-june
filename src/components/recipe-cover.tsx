import Image from "next/image";
import type { SanityImageSource } from "@sanity/image-url";
import { urlForImage } from "@/sanity/lib/image";
import { PawMark } from "@/components/paw-mark";

export function RecipeCover({
  image,
  title,
  className,
}: {
  image?: SanityImageSource | null;
  title: string;
  className?: string;
}) {
  if (!image) {
    return (
      <div
        className={`flex h-full flex-col items-center justify-center gap-3 bg-linear-to-br from-terracotta-wash via-paper-sunk to-clay-wash px-5 text-center ${className ?? ""}`}
      >
        <PawMark className="h-6 w-6 text-clay/60" />
        <span className="editorial-display text-2xl leading-tight text-terracotta/80">
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
      className={`h-full w-full object-cover ${className ?? ""}`}
    />
  );
}
