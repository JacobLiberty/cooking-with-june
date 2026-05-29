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
        className={`flex h-full flex-col items-center justify-center gap-2 bg-paper-sunk px-4 text-center ${className ?? ""}`}
      >
        <PawMark className="h-5 w-5 text-clay/70" />
        <span className="editorial-display text-xl text-ink/70">{title}</span>
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
