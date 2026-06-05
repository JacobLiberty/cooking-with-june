/** A timer found in a step's text, e.g. "25 min" → 1500 seconds. */
export type StepTimer = { label: string; seconds: number };

const UNIT_SECONDS: Record<string, number> = {
  h: 3600,
  hr: 3600,
  hrs: 3600,
  hour: 3600,
  hours: 3600,
  m: 60,
  min: 60,
  mins: 60,
  minute: 60,
  minutes: 60,
  s: 1,
  sec: 1,
  secs: 1,
  second: 1,
  seconds: 1,
};

const DURATION_RE = /(\d+(?:\.\d+)?)\s*(hours?|hrs?|minutes?|mins?|seconds?|secs?|h|m|s)\b/gi;

/**
 * Extract durations mentioned in a step ("simmer for 25 minutes") as tappable
 * timers. De-duped by total seconds, in order of appearance.
 */
export function parseStepTimers(text: string): StepTimer[] {
  const out: StepTimer[] = [];
  const seen = new Set<number>();
  for (const match of text.matchAll(DURATION_RE)) {
    const value = parseFloat(match[1]);
    const unit = match[2].toLowerCase();
    const seconds = Math.round(value * (UNIT_SECONDS[unit] ?? 0));
    if (!seconds || seen.has(seconds)) continue;
    seen.add(seconds);
    const short = unit[0] === "h" ? "hr" : unit[0] === "m" ? "min" : "sec";
    out.push({ label: `${value} ${short}`, seconds });
  }
  return out;
}

/**
 * Which of the recipe's ingredients are named in a step's text (whole-word,
 * case-insensitive). Used to surface "what this step uses" in cook mode.
 */
export function ingredientsInStep(
  text: string,
  names: (string | null | undefined)[],
): string[] {
  const lower = text.toLowerCase();
  const found: string[] = [];
  for (const name of names) {
    const clean = name?.trim();
    if (!clean) continue;
    // match on any significant word of the name (≥3 chars), whole-word, so
    // "Yellow onion" matches a step that just says "onion".
    const tokens = clean
      .toLowerCase()
      .split(/\s+/)
      .filter((t) => t.length >= 3);
    const hit = tokens.some((t) =>
      new RegExp(`\\b${escapeRegExp(t)}\\b`).test(lower),
    );
    if (hit && !found.includes(clean)) found.push(clean);
  }
  return found;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
