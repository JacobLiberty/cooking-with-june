import type { MetadataRoute } from "next";
import { client } from "@/sanity/lib/client";
import { RECIPE_SLUGS_QUERY } from "@/sanity/lib/queries";
import { SITE_URL } from "@/lib/site";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const slugs = await client.fetch<{ slug: string }[]>(RECIPE_SLUGS_QUERY);
  const recipes = (slugs ?? [])
    .filter((s) => s.slug)
    .map((s) => ({
      url: `${SITE_URL}/recipe/${s.slug}`,
      changeFrequency: "monthly" as const,
      priority: 0.8,
    }));
  return [
    { url: SITE_URL, changeFrequency: "weekly", priority: 1 },
    ...recipes,
  ];
}
