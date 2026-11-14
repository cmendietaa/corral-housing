import type OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import type { ParsedListing } from "@/lib/parse-listing";
import type { ImageType } from "./image";
import { PROMPT_VERSION, instructions, listingInput } from "./prompt";
import { aiListingSchema, toParsed } from "./schema";

/**
 * One model call that turns listing text and/or screenshots into form fields, plus the telemetry
 * the benchmark needs. No server-only import, so the benchmark runs this exact
 * code. Throws on API errors; lib/ai-extract.ts turns those into a fallback.
 */

// A small, cheap model is plenty for pulling a few fields out of a paste.
export const DEFAULT_MODEL = "gpt-5-mini";

export type Screenshot = { type: ImageType; base64: string };
export type ExtractInput = { text?: string; images?: Screenshot[] };

/** Screenshots need "high" detail to read small print; the benchmark can try others. */
export type ImageDetail = "low" | "high" | "auto";

/** Text alone goes as a plain string (as before); screenshots go as one message with text and image parts. */
function buildInput(input: ExtractInput, detail: ImageDetail) {
  const text = input.text?.trim() ?? "";
  if (!input.images?.length) return listingInput(text);
  return [
    {
      role: "user" as const,
      content: [
        ...(text ? [{ type: "input_text" as const, text: listingInput(text) }] : []),
        { type: "input_text" as const, text: `Screenshots of the listing (${input.images.length}):` },
        ...input.images.map((img) => ({
          type: "input_image" as const,
          image_url: `data:${img.type};base64,${img.base64}`,
          detail
        }))
      ]
    }
  ];
}

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
  opts: { model?: string; now?: Date; imageDetail?: ImageDetail } = {}
): Promise<ExtractResult> {
  const model = opts.model ?? DEFAULT_MODEL;
  const today = (opts.now ?? new Date()).toISOString().slice(0, 10);
  const started = performance.now();

  const response = await client.responses.parse({
    model,
    instructions: instructions(today),
    input: buildInput(input, opts.imageDetail ?? "high"),
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
