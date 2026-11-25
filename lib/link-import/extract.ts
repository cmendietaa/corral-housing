import { aiConfigured, extractWithAI } from "@/lib/ai-extract";
import { takeAiSlots } from "@/lib/ai-limit";
import { parsedListingSchema, parseListingText, type ParsedListing } from "@/lib/parse-listing";
import type { PageFacts } from "./read-page";

/**
 * Turn a listing page's text (and the facts it publishes about itself) into
 * form fields for the person to check. Shared by link import (Corral fetched
 * the page) and Send to Corral (the person's browser sent it).
 */
export async function extractFacts(
  read: { facts: PageFacts; text: string },
  url: string,
  ip: string
): Promise<{ fields: ParsedListing; source: "ai" | "parser"; note?: string }> {
  let fields: ParsedListing;
  let source: "ai" | "parser" = "parser";
  let note: string | undefined;
  const ai = aiConfigured() && takeAiSlots(ip, 1) ? await extractWithAI({ text: read.text }) : null;
  if (ai) {
    fields = ai;
    source = "ai";
  } else {
    fields = parseListingText(read.text);
    if (aiConfigured()) note = "AI autofill wasn't available, so the basic reader filled what it could.";
  }

  // Facts the page publishes about itself (structured data) are the most reliable
  // for the address and room counts; the reader's take wins for the name and rent.
  const f = read.facts;
  const merged = {
    ...fields,
    url,
    title: fields.title ?? f.title,
    address: f.address ?? fields.address,
    rentCents: fields.rentCents ?? f.rentCents,
    beds: f.beds ?? fields.beds,
    baths: f.baths ?? fields.baths
  };
  const checked = parsedListingSchema.safeParse(merged);
  return { fields: checked.success ? checked.data : fields, source, ...(note ? { note } : {}) };
}
