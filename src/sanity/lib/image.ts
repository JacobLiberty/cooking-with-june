import { createImageUrlBuilder } from "@sanity/image-url";
import type { SanityImageSource } from "@sanity/image-url";
import { client } from "@/sanity/lib/client";

const builder = createImageUrlBuilder(client);

export function urlForImage(source: SanityImageSource) {
  return builder.image(source);
}
