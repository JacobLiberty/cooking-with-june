import Anthropic from "@anthropic-ai/sdk";
import { buildSystemRules, buildUserPrompt, ENRICHMENT_TOOL } from "@/lib/enrichment/prompt";

export type RawEnrichmentItem = { name: string } & Record<string, unknown>;

const HAIKU = "claude-haiku-4-5";
const SONNET = "claude-sonnet-4-6";

/**
 * Call Claude once for a batch of names. Returns the raw `items` array (caller
 * validates each). System rules are sent with cache_control so repeat batches
 * reuse the cached prefix. Falls back to Sonnet if Haiku output is unusable.
 */
export async function enrichBatch(
  names: string[],
  opts: { model?: string } = {},
): Promise<RawEnrichmentItem[]> {
  const client = new Anthropic(); // reads ANTHROPIC_API_KEY from env
  const model = opts.model ?? HAIKU;

  const message = await client.messages.create({
    model,
    max_tokens: 4096,
    system: [
      { type: "text", text: buildSystemRules(), cache_control: { type: "ephemeral" } },
    ],
    tools: [ENRICHMENT_TOOL as Anthropic.Tool],
    tool_choice: { type: "tool", name: ENRICHMENT_TOOL.name },
    messages: [{ role: "user", content: buildUserPrompt(names) }],
  });

  const toolUse = message.content.find((b) => b.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    if (model === HAIKU) return enrichBatch(names, { model: SONNET });
    throw new Error("Enrichment: no tool_use block in response");
  }
  const input = toolUse.input as { items?: RawEnrichmentItem[] };
  return input.items ?? [];
}

export { HAIKU, SONNET };
