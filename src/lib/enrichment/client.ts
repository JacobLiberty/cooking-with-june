import Anthropic from "@anthropic-ai/sdk";
import { buildSystemRules, buildUserPrompt, ENRICHMENT_TOOL } from "@/lib/enrichment/prompt";

export type RawEnrichmentItem = { name: string } & Record<string, unknown>;

const HAIKU = "claude-haiku-4-5";
const SONNET = "claude-sonnet-4-6";

type EnrichModel = typeof HAIKU | typeof SONNET;

/**
 * Call Claude once for a batch of names. Returns the raw `items` array (caller
 * validates each). System rules are sent with cache_control so repeat batches
 * reuse the cached prefix. Falls back to Sonnet if Haiku output is unusable.
 * Throws on a schema violation (no tool_use, or no items) so a bad batch is
 * visible rather than silently dropped — the runner is idempotent, so re-running
 * is safe.
 */
export async function enrichBatch(
  names: string[],
  opts: { model?: EnrichModel } = {},
): Promise<RawEnrichmentItem[]> {
  if (names.length === 0) return [];
  const client = new Anthropic(); // reads ANTHROPIC_API_KEY from env
  const model: EnrichModel = opts.model ?? HAIKU;

  const message = await client.messages.create({
    model,
    // ~150 tokens/item; sized for batches up to ~40 items. Revisit if BATCH grows.
    max_tokens: 8192,
    system: [
      { type: "text", text: buildSystemRules(), cache_control: { type: "ephemeral" } },
    ],
    tools: [ENRICHMENT_TOOL as Anthropic.Tool],
    tool_choice: { type: "tool", name: ENRICHMENT_TOOL.name },
    messages: [{ role: "user", content: buildUserPrompt(names) }],
  });

  const toolUse = message.content.find((b) => b.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    // Retry once on the stronger model before giving up.
    if (model !== SONNET) return enrichBatch(names, { model: SONNET });
    throw new Error("Enrichment: no tool_use block in response");
  }
  const input = toolUse.input as { items?: unknown };
  if (!Array.isArray(input.items)) {
    if (model !== SONNET) return enrichBatch(names, { model: SONNET });
    throw new Error("Enrichment: tool_use input had no items array");
  }
  return input.items as RawEnrichmentItem[];
}

export { HAIKU, SONNET };
