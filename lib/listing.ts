import { z } from "zod";

export const LISTING_STATUSES = [
  "considering",
  "contacted",
  "tour_scheduled",
  "applied",
  "passed",
  "unavailable"
] as const;

export type ListingStatus = (typeof LISTING_STATUSES)[number];

export const STATUS_LABELS: Record<ListingStatus, string> = {
  considering: "Considering",
  contacted: "Contacted",
  tour_scheduled: "Tour scheduled",
  applied: "Applied",
  passed: "Passed",
  unavailable: "Unavailable"
};

/** Passed and Unavailable places are out of the running and render grayed out. */
export function isClosedStatus(status: ListingStatus): boolean {
  return status === "passed" || status === "unavailable";
}

export const PARKING_OPTIONS = ["garage", "driveway", "street", "none"] as const;
export const PARKING_LABELS: Record<(typeof PARKING_OPTIONS)[number], string> = {
  garage: "Garage",
  driveway: "Driveway or lot",
  street: "Street only",
  none: "No parking"
};

export const LAUNDRY_OPTIONS = ["in_unit", "on_site", "none"] as const;
export const LAUNDRY_LABELS: Record<(typeof LAUNDRY_OPTIONS)[number], string> = {
  in_unit: "In unit",
  on_site: "On site",
  none: "None"
};

/** Only http(s) links, so a saved "URL" can never be a javascript: or data: link. */
export const httpUrl = z
  .string()
  .trim()
  .url("Paste the full link, starting with https://")
  .refine((value) => /^https?:\/\//i.test(value), "Link must start with http:// or https://");

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a full date");

export const listingSchema = z.object({
  id: z.string(),
  title: z.string().trim().min(1, "Add an address or a short title").max(120),
  address: z.string().trim().max(200).nullable(),
  /** Optional: screenshots and word-of-mouth places often have no link. */
  url: httpUrl.nullable(),
  rentCents: z.number().int().nonnegative().nullable(),
  beds: z.number().nonnegative().max(20).nullable(),
  baths: z.number().nonnegative().max(20).nullable(),
  leaseStart: isoDate.nullable(),
  leaseEnd: isoDate.nullable(),
  parking: z.enum(PARKING_OPTIONS).nullable(),
  laundry: z.enum(LAUNDRY_OPTIONS).nullable(),
  lat: z.number().min(-90).max(90).nullable(),
  lng: z.number().min(-180).max(180).nullable(),
  status: z.enum(LISTING_STATUSES),
  starred: z.boolean(),
  notes: z.string().max(2000).nullable(),
  /** One next action per place (PRD). Null description means no next action. */
  nextAction: z.string().trim().max(200).nullable(),
  nextActionAssignee: z.string().nullable(),
  nextActionDue: isoDate.nullable(),
  updatedAt: z.string()
});

export type Listing = z.infer<typeof listingSchema>;

/** What a person can type when adding or editing a place. Server-managed fields are excluded. */
export const listingInputSchema = listingSchema.omit({ id: true, updatedAt: true });
export type ListingInput = z.infer<typeof listingInputSchema>;
export type ListingPatch = Partial<ListingInput>;

export type Member = { id: string; name: string };

export type Board = {
  id: string;
  name: string;
  leaseYear: string;
  members: Member[];
  /** Per-person monthly budget in cents, or null when the group hasn't set one. */
  budgetPerPersonCents: number | null;
};

export function emptyListingInput(): ListingInput {
  return {
    title: "",
    address: null,
    url: null,
    rentCents: null,
    beds: null,
    baths: null,
    leaseStart: null,
    leaseEnd: null,
    parking: null,
    laundry: null,
    lat: null,
    lng: null,
    status: "considering",
    starred: false,
    notes: null,
    nextAction: null,
    nextActionAssignee: null,
    nextActionDue: null
  };
}
