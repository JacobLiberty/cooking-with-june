import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Cooking with June",
    short_name: "June",
    description: "A warm, editorial home cookbook by Jacob & Lily.",
    start_url: "/",
    display: "standalone",
    background_color: "#faf4ea",
    theme_color: "#55622f",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icon-maskable.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
