import Anthropic from "@anthropic-ai/sdk";
import { buildImportSystemRules, buildImportUserPrompt, IMPORT_TOOL } from "@/lib/import/prompt";

const HAIKU = "claude-haiku-4-5";
const SONNET = "claude-sonnet-4-6";
type ImportModel = typeof HAIKU | typeof SONNET;

/**
 * Call Claude once to normalize a blurb. Returns the raw tool input (caller
 * validates via validateImportResult). System rules are cached; falls back to
 * Sonnet if Haiku returns no usable tool_use.
 */
export async function importRecipeBlurb(
  blurb: string,
  opts: { model?: ImportModel } = {},
): Promise<unknown> {
  const client = new Anthropic(); // reads ANTHROPIC_API_KEY
  const model: ImportModel = opts.model ?? HAIKU;

  const message = await client.messages.create({
    model,
    max_tokens: 4096,
    system: [
      { type: "text", text: buildImportSystemRules(), cache_control: { type: "ephemeral" } },
    ],
    tools: [IMPORT_TOOL as Anthropic.Tool],
    tool_choice: { type: "tool", name: IMPORT_TOOL.name },
    messages: [{ role: "user", content: buildImportUserPrompt(blurb) }],
  });

  const toolUse = message.content.find((b) => b.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    if (model !== SONNET) return importRecipeBlurb(blurb, { model: SONNET });
    throw new Error("Import: no tool_use block in response");
  }
  return toolUse.input;
}

export { HAIKU, SONNET };
