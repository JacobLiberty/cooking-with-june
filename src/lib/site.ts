/** Canonical site origin. Set NEXT_PUBLIC_SITE_URL in production (no trailing slash). */
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://cookingwithjune.com";
