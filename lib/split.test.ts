import { describe, expect, it } from "vitest";
import { defaultRooms, defaultRoomTypes, shareRange, sharesByRoom } from "./split";

describe("filling bedrooms", () => {
  it("fills rooms as evenly as it can, bigger rooms first", () => {
    expect(defaultRooms(4, 3)).toEqual([2, 1, 1]);
    expect(defaultRooms(6, 2)).toEqual([3, 3]);
    expect(defaultRooms(5, 3)).toEqual([2, 2, 1]);
    expect(defaultRooms(2, 4)).toEqual([1, 1]);
  });
  it("names the room setup", () => {
    expect(defaultRoomTypes(5, 3)).toEqual(["double", "double", "single"]);
    // Bedrooms unknown: assume doubles.
    expect(defaultRoomTypes(4, null)).toEqual(["double", "double"]);
  });
});

describe("shares by room", () => {
  it("charges a single more than a spot in a double, and adds up to the rent", () => {
    const s = sharesByRoom(720000, [1, 2, 2]);
    expect(s).toHaveLength(5);
    expect(s[0]).toBeGreaterThan(s[1]!);
    expect(s.reduce((a, b) => a + b, 0)).toBe(720000);
    expect(s[0]).toBe(180000);
    expect(s[1]).toBe(135000);
  });
});

describe("share range", () => {
  const place = { rentCents: 720000, beds: 3 };
  it("shows a range while the split is undecided", () => {
    expect(shareRange({ ...place, peopleCount: 5 }, 4)).toEqual({ lo: 135000, hi: 180000, decided: false });
  });
  it("is one number when everyone shares alike", () => {
    expect(shareRange({ rentCents: 480000, beds: 2 }, 4)).toEqual({ lo: 120000, hi: 120000, decided: false });
  });
  it("follows a decided split", () => {
    expect(shareRange({ ...place, split: { mode: "even" } }, 4)).toEqual({ lo: 180000, hi: 180000, decided: true });
    const custom = { ...place, split: { mode: "custom" as const, shares: [{ who: "a", cents: 200000 }, { who: "b", cents: 173300 }, { who: "c", cents: 173300 }, { who: "d", cents: 173400 }] } };
    expect(shareRange(custom, 4)).toEqual({ lo: 173300, hi: 200000, decided: true });
  });
  it("a per-person price is everyone's share", () => {
    expect(shareRange({ rentCents: 115000, priceBasis: "per_person" }, 4)).toEqual({ lo: 115000, hi: 115000, decided: true });
  });
  it("splits evenly when bedrooms are unknown", () => {
    expect(shareRange({ rentCents: 480000, beds: null }, 4)).toEqual({ lo: 120000, hi: 120000, decided: false });
  });
});

describe("saved splits stay honest", () => {
  it("recomputes a room split from today's rent", () => {
    const p = { rentCents: 800000, beds: 3, peopleCount: 5, split: { mode: "by_room" as const, rooms: ["single", "double", "double"] as ("single" | "double")[], shares: [{ who: "a", cents: 1 }] } };
    expect(shareRange(p, 4)).toEqual({ lo: 150000, hi: 200000, decided: true });
  });
  it("shows the range again when custom amounts no longer add up", () => {
    const p = { rentCents: 500000, beds: 2, split: { mode: "custom" as const, shares: [{ who: "a", cents: 120000 }, { who: "b", cents: 120000 }, { who: "c", cents: 120000 }, { who: "d", cents: 120000 }] } };
    expect(shareRange(p, 4)).toEqual({ lo: 125000, hi: 125000, decided: false });
  });
  it("starts a studio as one room", () => {
    expect(defaultRoomTypes(2, 0)).toEqual(["double"]);
  });
});

