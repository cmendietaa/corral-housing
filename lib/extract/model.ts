import type OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import type { ParsedListing } from "@/lib/parse-listing";
import { PROMPT_VERSION, instructions, listingInput } from "./prompt";
import { aiListingSchema, toParsed } from "./schema";

/**
 * One model call that turns listing text into form fields, plus the telemetry
 * the benchmark needs. No server-only import, so the benchmark runs this exact
 * code. Throws on API errors; lib/ai-extract.ts turns those into a fallback.
 */

// A small, cheap model is plenty for pulling a few fields out of a paste.
export const DEFAULT_MODEL = "gpt-5-mini";

export type ExtractInput = { text: string };

export type ExtractResult = {
  /** Null when the model refused, was cut off, or returned output that didn't match the schema. */
  fields: ParsedListing | null;
  dropped: (keyof ParsedListing)[];
  usage: { inputTokens: number; outputTokens: number } | null;
  latencyMs: number;
  status: string | null;
  model: string;
  promptVersion: string;
};

export async function extractListing(
  client: OpenAI,
  input: ExtractInput,
  opts: { model?: string; now?: Date } = {}
): Promise<ExtractResult> {
  const model = opts.model ?? DEFAULT_MODEL;
  const today = (opts.now ?? new Date()).toISOString().slice(0, 10);
  const started = performance.now();

  const response = await client.responses.parse({
    model,
    instructions: instructions(today),
    input: listingInput(input.text),
    text: { format: zodTextFormat(aiListingSchema, "listing") },
    store: false
  });

  const latencyMs = Math.round(performance.now() - started);
  const usage = response.usage ? { inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens } : null;
  const base = { usage, latencyMs, status: response.status ?? null, model, promptVersion: PROMPT_VERSION };

  // A refusal or a cut-off answer leaves output_parsed empty; re-check the shape anyway.
  const checked = aiListingSchema.safeParse(response.output_parsed);
  if (!checked.success) return { ...base, fields: null, dropped: [] };
  return { ...base, ...toParsed(checked.data) };
}
