import { z } from "zod";
import { EMPTY_PARSE, parsedListingSchema, type ParsedListing } from "@/lib/parse-listing";

/**
 * What the model is asked to return, and how its answer becomes form fields.
 * Shared by the API route and the extraction benchmark, so both use the exact
 * same rules.
 */

// Plain types and enums only; every value is re-checked by toParsed() afterwards.
export const aiListingSchema = z.object({
  title: z.string().nullable().describe("A short nickname for the place, under 60 characters, without the price"),
  address: z.string().nullable().describe("Street address, with the city if the text gives it"),
  url: z.string().nullable().describe("The listing's http(s) link, if the text contains one"),
  rent_dollars: z.number().nullable().describe("Monthly rent for the whole unit in US dollars"),
  beds: z.number().nullable(),
  baths: z.number().nullable(),
  lease_start: z.string().nullable().describe("YYYY-MM-DD"),
  lease_end: z.string().nullable().describe("YYYY-MM-DD"),
  parking: z.enum(["garage", "driveway", "street", "none"]).nullable(),
  laundry: z.enum(["in_unit", "on_site", "none"]).nullable()
});
export type AiListing = z.infer<typeof aiListingSchema>;

export type ParsedResult = {
  fields: ParsedListing;
  /** Fields the model filled in that failed the app's rules and were dropped. */
  dropped: (keyof ParsedListing)[];
};

/** Keep each field only if it passes the app's own rules; anything else becomes null. */
export function toParsed(ai: AiListing): ParsedResult {
  const candidate: ParsedListing = {
    title: ai.title?.trim().slice(0, 120) || null,
    address: ai.address?.trim().slice(0, 200) || null,
    url: ai.url?.trim() || null,
    rentCents: ai.rent_dollars === null ? null : Math.round(ai.rent_dollars * 100),
    beds: ai.beds,
    baths: ai.baths,
    leaseStart: ai.lease_start,
    leaseEnd: ai.lease_end,
    parking: ai.parking,
    laundry: ai.laundry
  };
  const fields: ParsedListing = { ...EMPTY_PARSE };
  const dropped: (keyof ParsedListing)[] = [];
  for (const key of Object.keys(candidate) as (keyof ParsedListing)[]) {
    if (candidate[key] === null) continue;
    const field = parsedListingSchema.shape[key].safeParse(candidate[key]);
    if (field.success) (fields as Record<string, unknown>)[key] = field.data;
    else dropped.push(key);
  }
  if (fields.leaseStart && fields.leaseEnd && fields.leaseEnd < fields.leaseStart) {
    fields.leaseEnd = null;
    dropped.push("leaseEnd");
  }
  return { fields, dropped };
}
