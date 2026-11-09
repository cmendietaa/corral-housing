import type { Board, Listing } from "@/lib/listing";
import type { BoardSnapshot } from "@/lib/stores/types";

/**
 * The public demo board. Everything here is fictional: street names are real
 * Isla Vista and Goleta streets, but the house numbers, prices, people and
 * links are made up. Links use example.com, which is reserved and never resolves
 * to a real listing.
 */

export const DEMO_MEMBERS = [
  { id: "maya", name: "Maya" },
  { id: "jordan", name: "Jordan" },
  { id: "sam", name: "Sam" },
  { id: "priya", name: "Priya" }
] as const;

/** ISO date (YYYY-MM-DD) in local time. */
function isoDay(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** The next Friday on or after `from`, so the PRD's "by Friday" example always looks current. */
function upcomingFriday(from: Date): string {
  const d = new Date(from);
  d.setDate(d.getDate() + ((5 - d.getDay() + 7) % 7));
  return isoDay(d);
}

function plusDays(from: Date, days: number): string {
  const d = new Date(from);
  d.setDate(d.getDate() + days);
  return isoDay(d);
}

export function createDemoSnapshot(now: Date = new Date()): BoardSnapshot {
  const year = now.getMonth() >= 8 ? now.getFullYear() + 1 : now.getFullYear();
  const leaseStart = `${year}-09-01`;
  const leaseEnd = `${year + 1}-06-30`;
  const stamp = now.toISOString();

  const board: Board = {
    id: "demo",
    name: `Our ${year}–${String(year + 1).slice(2)} place`,
    leaseYear: `${year}–${year + 1}`,
    members: DEMO_MEMBERS.map((m) => ({ ...m })),
    budgetPerPersonCents: 150000
  };

  const base = {
    leaseStart,
    leaseEnd,
    notes: null,
    nextAction: null,
    nextActionAssignee: null,
    nextActionDue: null,
    starred: false,
    updatedAt: stamp
  } satisfies Partial<Listing>;

  const listings: Listing[] = [
    {
      ...base,
      id: "demo-sabado",
      title: "Sabado Tarde 4-bed",
      address: "6512 Sabado Tarde Rd, Isla Vista",
      url: "https://example.com/listings/sabado-tarde-4br",
      rentCents: 540000,
      beds: 4,
      baths: 2,
      parking: null,
      laundry: "on_site",
      lat: 34.41185,
      lng: -119.85815,
      status: "contacted",
      starred: true,
      notes: "Two blocks from Pardall. Upstairs unit, small balcony.",
      nextAction: "Ask whether parking is included",
      nextActionAssignee: "maya",
      nextActionDue: upcomingFriday(now)
    },
    {
      ...base,
      id: "demo-dp",
      title: "Del Playa oceanside",
      address: "6681 Del Playa Dr, Isla Vista",
      url: "https://example.com/listings/del-playa-oceanside",
      rentCents: 690000,
      beds: 3,
      baths: 2,
      parking: "street",
      laundry: "in_unit",
      lat: 34.40965,
      lng: -119.86255,
      status: "tour_scheduled",
      starred: true,
      notes: "Ocean view from the back deck. Loud on weekends.",
      nextAction: "Bring the move-in checklist to the tour",
      nextActionAssignee: "jordan",
      nextActionDue: plusDays(now, 2)
    },
    {
      ...base,
      id: "demo-trigo",
      title: "Trigo duplex, back unit",
      address: "6745 Trigo Rd, Isla Vista",
      url: "https://example.com/listings/trigo-duplex",
      rentCents: null,
      beds: 4,
      baths: 1.5,
      parking: "driveway",
      laundry: null,
      lat: 34.41255,
      lng: -119.86395,
      status: "considering",
      notes: "Listing says “call for price”."
    },
    {
      ...base,
      id: "demo-embarcadero",
      title: "Embarcadero del Norte 2-bed",
      address: "Embarcadero del Norte, Isla Vista (unit TBD)",
      url: "https://example.com/listings/embarcadero-2br",
      rentCents: 360000,
      beds: 2,
      baths: 1,
      parking: "none",
      laundry: "on_site",
      lat: null,
      lng: null,
      status: "considering",
      notes: "Could work if two of us take a bigger room each.",
      nextAction: "Find the exact address and drop a pin",
      nextActionAssignee: "priya",
      nextActionDue: null
    },
    {
      ...base,
      id: "demo-picasso",
      title: "Picasso Rd house",
      address: "6559 Picasso Rd, Isla Vista",
      url: "https://example.com/listings/picasso-house",
      rentCents: 620000,
      beds: 4,
      baths: 2,
      parking: "driveway",
      laundry: "in_unit",
      lat: 34.41415,
      lng: -119.85625,
      status: "passed",
      notes: "Landlord wanted a double deposit and no subletting."
    },
    {
      ...base,
      id: "demo-goleta",
      title: "Goleta house off Calle Real",
      address: "Calle Real, Goleta",
      url: "https://example.com/listings/goleta-calle-real",
      rentCents: 580000,
      beds: 4,
      baths: 3,
      parking: "garage",
      laundry: "in_unit",
      lat: 34.43935,
      lng: -119.82345,
      status: "applied",
      notes: "15 minutes by bike. Quiet street, big yard.",
      nextAction: "Send pay stubs to the property manager",
      nextActionAssignee: "sam",
      nextActionDue: plusDays(now, 3)
    }
  ];

  return { board, listings };
}
