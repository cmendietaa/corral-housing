import "server-only";
import OpenAI from "openai";
import type { ParsedListing } from "@/lib/parse-listing";
import { DEFAULT_MODEL, extractListing, type ExtractInput } from "@/lib/extract/model";

/**
 * AI autofill for the API route. Returns null on any failure (no key, timeout,
 * rate limit, refusal, unparseable output) so the caller falls back to the
 * deterministic parser. Never throws to the route. The extraction itself lives
 * in lib/extract/ so the benchmark can run the same code.
 */

const MODEL = process.env.OPENAI_MODEL || DEFAULT_MODEL;

export function aiConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

export async function extractWithAI(input: ExtractInput, now: Date = new Date()): Promise<ParsedListing | null> {
  if (!aiConfigured()) return null;
  // Screenshots take longer to read than text.
  const client = new OpenAI({ timeout: input.images?.length ? 40_000 : 20_000, maxRetries: 1 });

  try {
    const result = await extractListing(client, input, { model: MODEL, now });
    if (!result.fields) {
      console.warn("parse-listing: no structured output", result.status);
      return null;
    }
    if (result.dropped.length) console.info(`parse-listing: dropped invalid fields: ${result.dropped.join(", ")}`);
    return result.fields;
  } catch (error) {
    if (error instanceof OpenAI.RateLimitError) console.warn(`parse-listing: OpenAI 429 (${error.code ?? "rate limit"})`);
    else if (error instanceof OpenAI.AuthenticationError) console.error("parse-listing: bad OPENAI_API_KEY");
    else if (error instanceof OpenAI.APIError) console.warn(`parse-listing: OpenAI error ${error.status} (${error.code ?? "no code"})`);
    else console.warn("parse-listing: request failed", error instanceof Error ? error.message : error);
    return null;
  }
}
