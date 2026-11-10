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

/** The next given weekday (0 = Sunday) on or after `from`. */
function upcoming(from: Date, weekday: number): string {
  const d = new Date(from);
  d.setDate(d.getDate() + ((weekday - d.getDay() + 7) % 7));
  return isoDay(d);
}

/**
 * Matches the v2 design handoff: "Our place by the bluffs", five places in the
 * running and one washed out, a $1,400 per-person budget.
 */
export function createDemoSnapshot(now: Date = new Date()): BoardSnapshot {
  const year = now.getMonth() >= 8 ? now.getFullYear() + 1 : now.getFullYear();
  const stamp = now.toISOString();
  const schoolYear = { leaseStart: `${year}-09-01`, leaseEnd: `${year + 1}-08-31` };

  const board: Board = {
    id: "demo",
    name: "Our place by the bluffs",
    leaseYear: `${year}–${String(year + 1).slice(2)}`,
    members: DEMO_MEMBERS.map((m) => ({ ...m })),
    budgetPerPersonCents: 140000
  };

  const base = {
    ...schoolYear,
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
      title: "Blue duplex",
      address: "6512 Sabado Tarde Rd, Isla Vista",
      url: "https://example.com/listings/sabado-tarde-blue-duplex",
      rentCents: 540000,
      beds: 4,
      baths: 2,
      parking: "driveway",
      laundry: "in_unit",
      lat: 34.410486,
      lng: -119.854462,
      status: "contacted",
      starred: true,
      notes: "Two blocks from Pardall. Listing mentions \"2 spots?\" for parking.",
      nextAction: "Ask whether parking is included",
      nextActionAssignee: "maya",
      nextActionDue: upcoming(now, 5)
    },
    {
      ...base,
      id: "demo-dp",
      title: "Oceanside upstairs",
      address: "6680 Del Playa Dr, Isla Vista",
      url: "https://example.com/listings/del-playa-oceanside-upstairs",
      rentCents: 720000,
      beds: 5,
      baths: 2,
      parking: "street",
      laundry: "in_unit",
      lat: 34.409837,
      lng: -119.861597,
      status: "tour_scheduled",
      starred: true,
      notes: "Ocean view from the deck. Loud on weekends.",
      nextAction: "Tour Sat 2pm, check the deck",
      nextActionAssignee: "jordan",
      nextActionDue: upcoming(now, 6)
    },
    {
      ...base,
      id: "demo-trigo",
      title: "Upstairs 3BR",
      address: "6545 Trigo Rd, Isla Vista",
      url: "https://example.com/listings/trigo-upstairs-3br",
      rentCents: null,
      beds: 3,
      baths: 1,
      leaseStart: null,
      leaseEnd: null,
      parking: null,
      laundry: "on_site",
      lat: 34.410844,
      lng: -119.85597,
      status: "considering",
      notes: "Listing says “call for price”."
    },
    {
      ...base,
      id: "demo-pardall",
      title: "Above the café",
      address: "6550 Pardall Rd, Isla Vista",
      url: "https://example.com/listings/pardall-above-the-cafe",
      rentCents: 480000,
      beds: 3,
      baths: 2,
      parking: "street",
      laundry: "on_site",
      lat: 34.413194,
      lng: -119.856439,
      status: "considering",
      notes: "Right on Pardall. Need to find the exact entrance and drop a pin."
    },
    {
      ...base,
      id: "demo-calle",
      title: "Goleta townhouse",
      address: "7150 Calle Real, Goleta",
      url: "https://example.com/listings/goleta-calle-real-townhouse",
      rentCents: 590000,
      beds: 4,
      baths: 2.5,
      leaseStart: `${year}-08-15`,
      leaseEnd: `${year + 1}-08-14`,
      parking: "garage",
      laundry: "in_unit",
      lat: 34.433039,
      lng: -119.878040,
      status: "applied",
      notes: "15 minutes by bike. Quiet street, garage.",
      nextAction: "Send guarantor form",
      nextActionAssignee: "sam",
      nextActionDue: plusDays(now, 12)
    },
    {
      ...base,
      id: "demo-colegio",
      title: "Corner house",
      address: "6800 El Colegio Rd, Isla Vista",
      url: "https://example.com/listings/el-colegio-corner-house",
      rentCents: 610000,
      beds: 4,
      baths: 2,
      leaseEnd: `${year + 1}-06-30`,
      parking: "driveway",
      laundry: "in_unit",
      lat: 34.417541,
      lng: -119.866698,
      status: "passed",
      notes: "Landlord wanted a double deposit and no subletting."
    }
  ];

  return { board, listings };
}
