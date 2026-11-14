import { listingSchema, type Listing, type ListingPatch } from "@/lib/listing";

/** A `public.listings` row as PostgREST returns it. */
export type ListingRow = {
  id: string;
  board_id: string;
  title: string;
  address: string | null;
  url: string | null;
  rent_cents: number | null;
  beds: number | string | null;
  baths: number | string | null;
  lease_start: string | null;
  lease_end: string | null;
  parking: string | null;
  laundry: string | null;
  lat: number | null;
  lng: number | null;
  status: string;
  starred: boolean;
  notes: string | null;
  next_action: string | null;
  next_action_assignee: string | null;
  next_action_due: string | null;
  updated_at: string;
};

const num = (v: number | string | null) => (v === null ? null : Number(v));

/** Database row → app Listing, validated so a bad row can't reach the UI. */
export function rowToListing(r: ListingRow): Listing {
  return listingSchema.parse({
    id: r.id,
    title: r.title,
    address: r.address,
    url: r.url,
    rentCents: r.rent_cents,
    beds: num(r.beds),
    baths: num(r.baths),
    leaseStart: r.lease_start,
    leaseEnd: r.lease_end,
    parking: r.parking,
    laundry: r.laundry,
    lat: r.lat,
    lng: r.lng,
    status: r.status,
    starred: r.starred,
    notes: r.notes,
    nextAction: r.next_action,
    nextActionAssignee: r.next_action_assignee,
    nextActionDue: r.next_action_due,
    updatedAt: r.updated_at
  });
}

const COLUMN: Record<keyof ListingPatch, keyof ListingRow> = {
  title: "title",
  address: "address",
  url: "url",
  rentCents: "rent_cents",
  beds: "beds",
  baths: "baths",
  leaseStart: "lease_start",
  leaseEnd: "lease_end",
  parking: "parking",
  laundry: "laundry",
  lat: "lat",
  lng: "lng",
  status: "status",
  starred: "starred",
  notes: "notes",
  nextAction: "next_action",
  nextActionAssignee: "next_action_assignee",
  nextActionDue: "next_action_due"
};

/** App patch → column update. Only known, writable columns pass through. */
export function patchToRow(patch: ListingPatch): Partial<ListingRow> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(patch)) {
    const column = COLUMN[key as keyof ListingPatch];
    if (column && value !== undefined) out[column] = value;
  }
  return out as Partial<ListingRow>;
}
