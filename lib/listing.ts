import { z } from "zod";

export const LISTING_STATUSES = [
  "considering",
  "contacted",
  "tour_scheduled",
  "applied",
  "passed",
  "unavailable"
] as const;

export const STATUS_LABELS: Record<(typeof LISTING_STATUSES)[number], string> = {
  considering: "Considering",
  contacted: "Contacted",
  tour_scheduled: "Tour scheduled",
  applied: "Applied",
  passed: "Passed",
  unavailable: "Unavailable"
};

/** Only http(s) links, so a saved "URL" can never be a javascript: or data: link. */
export const httpUrl = z
  .string()
  .trim()
  .url()
  .refine((value) => /^https?:\/\//i.test(value), "Link must start with http:// or https://");

export const listingSchema = z.object({
  id: z.string(),
  title: z.string().trim().min(1, "Add an address or a short title"),
  address: z.string().trim().nullable(),
  url: httpUrl,
  rentCents: z.number().int().nonnegative().nullable(),
  beds: z.number().nonnegative().nullable(),
  baths: z.number().nonnegative().nullable(),
  leaseStart: z.string().nullable(),
  leaseEnd: z.string().nullable(),
  parking: z.string().nullable(),
  laundry: z.string().nullable(),
  lat: z.number().min(-90).max(90).nullable(),
  lng: z.number().min(-180).max(180).nullable(),
  status: z.enum(LISTING_STATUSES),
  starred: z.boolean(),
  notes: z.string().nullable(),
  updatedAt: z.string()
});

export type Listing = z.infer<typeof listingSchema>;
export type ListingStatus = Listing["status"];
