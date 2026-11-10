import type { Listing } from "./listing";

export const UNKNOWN = "Unknown";

/**
 * Sort by monthly rent, cheapest first. Listings with unknown rent always sort
 * last (in either direction) and keep their original relative order.
 */
export function sortByRent<T extends Pick<Listing, "rentCents">>(
  listings: readonly T[],
  direction: "asc" | "desc" = "asc"
): T[] {
  return listings
    .map((listing, index) => ({ listing, index }))
    .sort((a, b) => {
      const ra = a.listing.rentCents;
      const rb = b.listing.rentCents;
      if (ra === null && rb === null) return a.index - b.index;
      if (ra === null) return 1;
      if (rb === null) return -1;
      const diff = direction === "asc" ? ra - rb : rb - ra;
      return diff !== 0 ? diff : a.index - b.index;
    })
    .map(({ listing }) => listing);
}

/** Unknown rent never meets a budget: we can't claim a place is affordable. */
export function meetsBudget(rentCents: number | null, budgetCents: number): boolean {
  return rentCents !== null && rentCents <= budgetCents;
}

/** Equal-share rent per person in cents, or null when rent or group size is unknown. */
export function rentPerPerson(rentCents: number | null, people: number | null): number | null {
  if (rentCents === null || people === null || !Number.isInteger(people) || people < 1) {
    return null;
  }
  return Math.ceil(rentCents / people);
}

export function formatRent(cents: number | null): string {
  if (cents === null) return UNKNOWN;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: cents % 100 === 0 ? 0 : 2
  }).format(cents / 100);
}

export type CompareCell = {
  text: string;
  /** Shorter text for phone layouts (e.g. "Within" instead of "Within budget"). */
  short?: string;
  unknown?: boolean;
  best?: boolean;
};

export type CompareRow = { key: string; label: string; cells: CompareCell[] };

type ComparePlace = Pick<
  Listing,
  | "rentCents"
  | "beds"
  | "baths"
  | "leaseStart"
  | "leaseEnd"
  | "parking"
  | "laundry"
  | "nextAction"
  | "nextActionAssignee"
  | "nextActionDue"
>;

const PARKING_RANK: Record<NonNullable<Listing["parking"]>, number> = { garage: 3, driveway: 2, street: 1, none: 0 };

/**
 * Marks the best value(s) in a row. Unknowns are never best, ties all win, and
 * nothing is highlighted when every known value is the same (nothing to choose).
 */
export function bestIndices(values: (number | null)[], better: "low" | "high"): Set<number> {
  const known = values.map((v, i) => ({ v, i })).filter((x): x is { v: number; i: number } => x.v !== null);
  if (known.length < 2) return new Set();
  const target = better === "low" ? Math.min(...known.map((x) => x.v)) : Math.max(...known.map((x) => x.v));
  if (known.every((x) => x.v === target)) return new Set();
  return new Set(known.filter((x) => x.v === target).map((x) => x.i));
}

function unknown(text = UNKNOWN): CompareCell {
  return { text, short: UNKNOWN, unknown: true };
}

function withBest(cells: CompareCell[], values: (number | null)[], better: "low" | "high"): CompareCell[] {
  const best = bestIndices(values, better);
  return cells.map((c, i) => (best.has(i) ? { ...c, best: true } : c));
}

/**
 * The comparison table, always in the same row order: Rent / mo, Per person,
 * Budget, Bedrooms, Bathrooms, Lease, Parking, Laundry, Next step.
 */
export function buildComparison(
  places: ComparePlace[],
  opts: {
    people: number | null;
    budgetPerPersonCents: number | null;
    formatLease: (start: string | null, end: string | null) => string;
    parkingLabel: (p: NonNullable<Listing["parking"]>) => string;
    laundryLabel: (l: NonNullable<Listing["laundry"]>) => string;
    ownerDue: (place: ComparePlace) => string | null;
  }
): CompareRow[] {
  const rents = places.map((p) => p.rentCents);
  const perPerson = places.map((p) => rentPerPerson(p.rentCents, opts.people));

  return [
    {
      key: "rent",
      label: "Rent / mo",
      cells: withBest(
        rents.map((r) => (r === null ? unknown() : { text: formatRent(r) })),
        rents,
        "low"
      )
    },
    {
      key: "perPerson",
      label: "Per person",
      cells: withBest(
        perPerson.map((r) => (r === null ? unknown() : { text: formatRent(r) })),
        perPerson,
        "low"
      )
    },
    {
      key: "budget",
      label: "Budget",
      cells: perPerson.map((r) => {
        if (opts.budgetPerPersonCents === null) return unknown("No budget set");
        if (r === null) return unknown("Rent unknown");
        return meetsBudget(r, opts.budgetPerPersonCents)
          ? { text: "Within budget", short: "Within" }
          : { text: "Over budget", short: "Over" };
      })
    },
    {
      key: "beds",
      label: "Bedrooms",
      cells: withBest(
        places.map((p) => (p.beds === null ? unknown() : { text: String(p.beds) })),
        places.map((p) => p.beds),
        "high"
      )
    },
    {
      key: "baths",
      label: "Bathrooms",
      cells: withBest(
        places.map((p) => (p.baths === null ? unknown() : { text: String(p.baths) })),
        places.map((p) => p.baths),
        "high"
      )
    },
    {
      key: "lease",
      label: "Lease",
      cells: places.map((p) =>
        !p.leaseStart && !p.leaseEnd ? unknown() : { text: opts.formatLease(p.leaseStart, p.leaseEnd) }
      )
    },
    {
      key: "parking",
      label: "Parking",
      cells: withBest(
        places.map((p) => (p.parking === null ? unknown() : { text: opts.parkingLabel(p.parking) })),
        places.map((p) => (p.parking === null ? null : PARKING_RANK[p.parking])),
        "high"
      )
    },
    {
      key: "laundry",
      label: "Laundry",
      cells: places.map((p) => (p.laundry === null ? unknown() : { text: opts.laundryLabel(p.laundry) }))
    },
    {
      key: "next",
      label: "Next step",
      cells: places.map((p) => {
        if (!p.nextAction) return { text: "None yet" };
        const who = opts.ownerDue(p);
        return { text: who ? `${p.nextAction} (${who})` : p.nextAction };
      })
    }
  ];
}
