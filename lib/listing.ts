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

/** Starred places first; otherwise the original order is kept. */
export function starredFirst<T extends { starred: boolean }>(items: readonly T[]): T[] {
  return [...items.filter((l) => l.starred), ...items.filter((l) => !l.starred)];
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

/**
 * How a place's price is quoted: the rent for the whole place, a price per
 * person (or bed), or "our part" (a sublet or one room: what the group pays).
 */
export const PRICE_BASES = ["whole", "per_person", "our_part"] as const;
export type PriceBasis = (typeof PRICE_BASES)[number];
export const PRICE_BASIS_LABELS: Record<PriceBasis, string> = {
  whole: "Whole place",
  per_person: "Per person",
  our_part: "Just our part"
};

export const ROOM_TYPES = ["single", "double", "triple"] as const;
export type RoomType = (typeof ROOM_TYPES)[number];

/**
 * How the rent is split once the group decides. Null on a listing means not
 * decided yet. `who` is a member id, or "spot-1", "spot-2"… for spots to fill.
 */
export const splitSchema = z.object({
  mode: z.enum(["even", "by_room", "custom"]),
  rooms: z.array(z.enum(ROOM_TYPES)).max(20).optional(),
  shares: z
    .array(z.object({ who: z.string().min(1).max(64), cents: z.number().int().nonnegative() }))
    .max(20)
    .optional()
});
export type Split = z.infer<typeof splitSchema>;

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
  /**
   * The photo that leads: "street" for Street View, a photo's id, or null to
   * pick automatically (the first added photo, else Street View).
   */
  cover: z.string().max(64).nullable().default(null),
  /** False hides Street View for this place (wrong building, ugly angle). */
  streetView: z.boolean().default(true),
  /** How the price is quoted (see PRICE_BASES). */
  priceBasis: z.enum(PRICE_BASES).default("whole"),
  /** How many people would live there; null means the group's size. */
  peopleCount: z.number().int().min(1).max(20).nullable().default(null),
  /** How the rent is split; null means not decided yet. */
  split: splitSchema.nullable().default(null),
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
  /** How many people are in the group; null means the number of members. */
  groupSize: number | null;
  /** The member viewing the board (private boards); the demo has none. */
  meId?: string | null;
};

/** What the settings screen can change about a board. Same limits as the database. */
export const boardDetailsSchema = z.object({
  name: z.string().trim().min(1, "Give the board a name").max(80, "Keep the name under 80 characters"),
  leaseYear: z.string().trim().max(20, "Keep the lease year short, like 2027–28"),
  budgetPerPersonCents: z.number().int().nonnegative().nullable(),
  /** Left out or null: the group is everyone on the board. */
  groupSize: z.number().int().min(1, "A group has at least 1 person").max(20, "Up to 20 people").nullable().default(null)
});

/** A roommate's name on a board. */
export const displayNameSchema = z.string().trim().min(1, "Add your name").max(40, "Keep your name under 40 characters");

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
    nextActionDue: null,
    cover: null,
    streetView: true,
    priceBasis: "whole",
    peopleCount: null,
    split: null
  };
}
