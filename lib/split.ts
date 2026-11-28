import { evenShare, peopleLiving, totalRent, type Priced } from "./compare";
import type { RoomType, Split } from "./listing";

/**
 * How a place's rent splits between the people living there.
 *
 * Until the group decides (split is null), a place shows a range: people fill
 * its bedrooms as evenly as they can, and a spot in a shared room costs less
 * than a room of your own. Once decided, the split is even, by room (each
 * room single, double or triple), or custom amounts.
 */

export type SplitPlace = Priced & { beds?: number | null; split?: Split | null };

/** What one person pays in a room with this many people, relative to a spot in a double. */
export function roomWeight(occupants: number): number {
  if (occupants <= 1) return 4 / 3; // a single pays about a third more
  if (occupants === 2) return 1;
  if (occupants === 3) return 0.8;
  return 0.7;
}

export const ROOM_SIZE: Record<RoomType, number> = { single: 1, double: 2, triple: 3 };

/** How N people fill B bedrooms as evenly as they can: the number of people in each room. */
export function defaultRooms(people: number, bedrooms: number): number[] {
  const rooms = Math.max(1, Math.round(bedrooms));
  if (people <= rooms) return Array.from({ length: people }, () => 1);
  const base = Math.floor(people / rooms);
  const extra = people % rooms;
  // Bigger rooms first, so the doubles (or triples) come before the singles.
  return Array.from({ length: rooms }, (_, i) => base + (i < extra ? 1 : 0));
}

/** Each person's share of `rent` for rooms with these occupancies, in room order. */
export function sharesByRoom(rent: number, occupancy: number[]): number[] {
  const units = occupancy.reduce((sum, n) => sum + n * roomWeight(n), 0);
  if (units === 0) return [];
  const raw = occupancy.flatMap((n) => Array.from({ length: n }, () => (rent * roomWeight(n)) / units));
  // Round to whole dollars and make them add up exactly, the last person absorbing the cents.
  const rounded = raw.map((x) => Math.round(x / 100) * 100);
  const diff = rent - rounded.reduce((a, b) => a + b, 0);
  if (rounded.length) rounded[rounded.length - 1]! += diff;
  return rounded;
}

/** A spread of what people pay, low to high (equal when everyone pays the same). */
export type ShareRange = { lo: number; hi: number; decided: boolean };

/** What each person pays at this place, as a range. Null when the rent or group is unknown. */
export function shareRange(p: SplitPlace, group: number | null): ShareRange | null {
  if (p.rentCents === null) return null;
  const decided = p.split != null;
  if (p.priceBasis === "per_person") return { lo: p.rentCents, hi: p.rentCents, decided: true };
  const people = peopleLiving(p, group);
  const rent = totalRent(p, group);
  if (people === null || rent === null) return null;

  let shares: number[] | null = null;
  let current = decided;
  if (p.split?.mode === "by_room" && p.split.rooms?.length) {
    // Always from today's rent, so a rent change can't leave old amounts behind.
    shares = sharesByRoom(rent, p.split.rooms.map((r) => ROOM_SIZE[r]));
  } else if (p.split?.mode === "custom" && p.split.shares?.length) {
    const saved = p.split.shares.map((s) => s.cents);
    // Custom amounts only count while they still add up to the rent for everyone living there.
    if (saved.length === people && saved.reduce((a, b) => a + b, 0) === rent) shares = saved;
    else current = false;
  }
  if (!shares && !current && p.split?.mode !== "even" && p.beds != null) {
    shares = sharesByRoom(rent, defaultRooms(people, p.beds === 0 ? 1 : p.beds));
  }

  if (!shares || shares.length === 0) {
    const each = evenShare(p, group);
    return each === null ? null : { lo: each, hi: each, decided: current };
  }
  return { lo: Math.min(...shares), hi: Math.max(...shares), decided: current };
}

/**
 * What `me` pays at this place, when a decided split names them and still
 * holds (a room split follows today's rent; custom amounts must still add up).
 * Null otherwise: then the place's range is what counts.
 */
export function myShare(p: SplitPlace, group: number | null, me: string | null | undefined): number | null {
  if (!me || !p.split?.shares?.length || p.priceBasis === "per_person") return null;
  const i = p.split.shares.findIndex((s) => s.who === me);
  if (i < 0) return null;
  const range = shareRange(p, group);
  if (!range?.decided) return null;
  if (p.split.mode === "by_room" && p.split.rooms?.length) {
    const rent = totalRent(p, group);
    return rent === null ? null : (sharesByRoom(rent, p.split.rooms.map((r) => ROOM_SIZE[r]))[i] ?? null);
  }
  return p.split.shares[i]!.cents;
}

/** The room setup a place starts from in the editor: its bedrooms filled as evenly as possible. */
export function defaultRoomTypes(people: number, bedrooms: number | null): RoomType[] {
  // Unknown bedrooms: assume doubles. A studio is one room.
  const rooms = bedrooms === null ? Math.max(1, Math.ceil(people / 2)) : bedrooms === 0 ? 1 : bedrooms;
  return defaultRooms(people, rooms).map((n) => (n <= 1 ? "single" : n === 2 ? "double" : "triple"));
}
