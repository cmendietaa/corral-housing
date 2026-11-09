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

export const COMPARE_ROWS = [
  "rent",
  "rentPerPerson",
  "beds",
  "baths",
  "lease",
  "parking",
  "laundry",
  "status"
] as const;
