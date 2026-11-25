import { describe, expect, it } from "vitest";
import { CAMPUS } from "./commute";
import { LISTING_STATUSES, LAUNDRY_OPTIONS, PARKING_OPTIONS } from "./listing";
import {
  DEFAULT_WEIGHTS,
  FACTORS,
  defaultPriorities,
  formatScore,
  formatStars,
  headline,
  rankPlaces,
  type Level,
  type Priorities,
  type RankPlace
} from "./rank";

let n = 0;
function place(over: Partial<RankPlace> = {}): RankPlace {
  n++;
  return {
    id: `p${n}`,
    title: `Place ${n}`,
    status: "considering",
    rentCents: 480000,
    beds: 4,
    baths: 2,
    leaseStart: "2027-09-01",
    parking: "driveway",
    laundry: "in_unit",
    lat: CAMPUS.lat,
    lng: CAMPUS.lng,
    ...over
  };
}
/** About `min` minutes by bike from campus (due north). */
const bikeAway = (min: number) => ({ lat: CAMPUS.lat + (min * 250) / 1.3 / 111_195, lng: CAMPUS.lng });

const people = 4;
const base: Priorities = { ...defaultPriorities({ budgetPerPersonCents: 140000 }), minBeds: 4 };
const withWeights = (w: Partial<Record<(typeof FACTORS)[number], Level>>): Priorities => ({ ...base, weights: { ...DEFAULT_WEIGHTS, ...w } });

describe("requirements", () => {
  it("defaults to the board budget, with no minimum bedrooms", () => {
    const d = defaultPriorities({ budgetPerPersonCents: 140000 });
    expect(d.maxRentPerPersonCents).toBe(140000);
    expect(d.minBeds).toBeNull();
    expect(d.weights).toEqual(DEFAULT_WEIGHTS);
  });

  it("moves a place over the max to doesn't-meet, with the reason in numbers", () => {
    const r = rankPlaces([place({ rentCents: 640000 })], base, people);
    expect(r.ranked).toHaveLength(0);
    expect(r.doesntMeet[0]!.reasons).toEqual(["$1,600/person is over your $1,400 max"]);
  });

  it("never ranks a place whose rent is unknown when there's a max", () => {
    const r = rankPlaces([place({ rentCents: null })], base, people);
    expect(r.ranked).toHaveLength(0);
    expect(r.missingInfo[0]!.reasons).toEqual(["Rent unknown"]);
  });

  it("a failure wins over an unknown", () => {
    const r = rankPlaces([place({ rentCents: null, beds: 2 })], base, people);
    expect(r.doesntMeet[0]!.reasons).toEqual(["2 bedrooms, you need 4"]);
    expect(r.missingInfo).toHaveLength(0);
  });

  it("checks move-in date, laundry and off-street parking", () => {
    const pr: Priorities = { ...base, moveInBy: "2027-09-01", needsLaundry: true, needsParking: true };
    const r = rankPlaces(
      [place({ leaseStart: "2027-09-15" }), place({ laundry: "none" }), place({ parking: "street" }), place({ laundry: "on_site", parking: "garage" })],
      pr,
      people
    );
    expect(r.doesntMeet.map((h) => h.reasons[0])).toEqual(["Starts Sep 15, after your Sep 1", "No laundry", "Street parking only"]);
    expect(r.ranked).toHaveLength(1);
  });

  it("leaves out Passed and Unavailable places", () => {
    const r = rankPlaces([place({ status: "passed" }), place({ status: "unavailable" }), place()], base, people);
    expect(r.ranked.length + r.missingInfo.length + r.doesntMeet.length).toBe(1);
  });

  it("names the requirement excluding the most places when nothing ranks", () => {
    const r = rankPlaces([place({ rentCents: 900000 }), place({ rentCents: 800000, beds: 2 }), place({ beds: 3 })], base, people);
    expect(r.ranked).toHaveLength(0);
    expect(r.tightest).toBe("maxRent");
  });
});

describe("scoring", () => {
  it("a cheap far place vs. an expensive close one flips with the weights", () => {
    const cheapFar = place({ title: "Cheap far", rentCents: 360000, ...bikeAway(18) });
    const closeDear = place({ title: "Close dear", rentCents: 540000, ...bikeAway(3) });
    const byPrice = rankPlaces([cheapFar, closeDear], withWeights({ price: 3, bike: 1 }), people);
    const byBike = rankPlaces([cheapFar, closeDear], withWeights({ price: 1, bike: 3 }), people);
    expect(byPrice.ranked[0]!.place.title).toBe("Cheap far");
    expect(byBike.ranked[0]!.place.title).toBe("Close dear");
  });

  it("price scores 1 at 60% of the max and 0 at the max", () => {
    const only = withWeights({ price: 3, bike: 0, bedrooms: 0, bathrooms: 0, amenities: 0 });
    const r = rankPlaces([place({ rentCents: 4 * 84000 }), place({ rentCents: 4 * 140000 }), place({ rentCents: 4 * 112000 })], only, people);
    expect(r.ranked.map((x) => x.score)).toEqual([100, 50, 0]);
  });

  it("an unknown preference gives a range, ranks by its middle, and shows ~", () => {
    const only = withWeights({ price: 0, bike: 0, bedrooms: 0, bathrooms: 0, amenities: 3 });
    const r = rankPlaces([place({ laundry: null, parking: "garage" })], only, people);
    const top = r.ranked[0]!;
    expect([top.lo, top.score, top.hi]).toEqual([50, 75, 100]);
    expect(top.missing).toEqual(["amenities"]);
    expect(formatScore(top)).toBe("~7.5");
  });

  it("formats a fully known score out of 10", () => {
    expect(formatScore({ score: 86.2, missing: [] })).toBe("8.6");
  });

  it("formats the score out of 5 for the stars", () => {
    expect(formatStars({ score: 86.2, missing: [] })).toBe("4.3");
    expect(formatStars({ score: 63, missing: [] })).toBe("3.2");
    expect(formatStars({ score: 75, missing: ["amenities"] })).toBe("~3.8");
  });

  it("all Don't care falls back to price", () => {
    const zero = withWeights({ price: 0, bike: 0, bedrooms: 0, bathrooms: 0, amenities: 0 });
    const r = rankPlaces([place({ rentCents: 500000 }), place({ rentCents: 400000 })], zero, people);
    expect(r.allDontCare).toBe(true);
    expect(r.ranked[0]!.place.rentCents).toBe(400000);
  });

  it("flags when no place has a pin but bike time matters", () => {
    expect(rankPlaces([place({ lat: null, lng: null })], base, people).noPins).toBe(true);
    expect(rankPlaces([place()], base, people).noPins).toBe(false);
  });

  it("without a max, price is scored against the board median", () => {
    const pr = { ...base, maxRentPerPersonCents: null };
    const r = rankPlaces([place({ rentCents: 400000 }), place({ rentCents: 600000 })], pr, people);
    expect(r.priceRef).toBe(125000);
    expect(r.ranked[0]!.place.rentCents).toBe(400000);
  });

  it("handles a studio and an unknown group size", () => {
    const r = rankPlaces([place({ beds: 0 })], { ...base, minBeds: null }, people);
    expect(r.ranked[0]!.factors.bedrooms.lo).toBe(0);
    const unknownGroup = rankPlaces([place()], base, null);
    expect(unknownGroup.missingInfo[0]!.reasons).toEqual(["Rent per person unknown (no group size)"]);
  });
});

describe("explanations", () => {
  it("states real values: one plus and one minus on the card", () => {
    const r = rankPlaces([place({ rentCents: 320000, parking: "street", laundry: "none", ...bikeAway(4) })], base, people);
    const line = headline(r.ranked[0]!);
    expect(line[0]).toEqual({ factor: "price", sign: "+", text: "$800/person, $600 under your max" });
    expect(line[1]).toEqual({ factor: "amenities", sign: "-", text: "no laundry, street parking only" });
    expect(r.ranked[0]!.facts.bike).toBe("about 4 min bike to campus");
  });

  it("a price minus says how little room is left", () => {
    const r = rankPlaces([place({ rentCents: 540000 })], base, people);
    expect(headline(r.ranked[0]!).find((x) => x.sign === "-")?.text).toBe("$1,350/person, only $50 under your max");
  });

  it("never states an unknown value", () => {
    const r = rankPlaces([place({ laundry: null, parking: null, lat: null, lng: null })], base, people);
    const top = r.ranked[0]!;
    expect(top.reasons.map((x) => x.factor)).not.toContain("amenities");
    expect(top.reasons.map((x) => x.factor)).not.toContain("bike");
    expect(top.facts.amenities).toBeNull();
    expect(top.facts.bike).toBeNull();
  });

  it("explains a place against the one above it", () => {
    const a = place({ title: "6545 Trigo", rentCents: 480000, baths: 1 });
    const b = place({ title: "6680 Del Playa", rentCents: 540000, baths: 2 });
    const r = rankPlaces([b, a], withWeights({ price: 3, bathrooms: 1 }), people);
    expect(r.ranked[0]!.vsAbove).toBeNull();
    expect(r.ranked[1]!.vsAbove).toBe("Ranks below 6545 Trigo mainly because it's $150/person more; it wins on bathrooms.");
  });

  it("flags a close call when one weight step changes #1", () => {
    const cheapFar = place({ rentCents: 360000, ...bikeAway(12) });
    const closeDear = place({ rentCents: 480000, ...bikeAway(3) });
    const r = rankPlaces([cheapFar, closeDear], withWeights({ price: 2, bike: 2, bedrooms: 0, bathrooms: 0, amenities: 0 }), people);
    expect(r.closeCall).not.toBeNull();
    const runaway = rankPlaces([place({ rentCents: 360000 }), place({ rentCents: 540000, parking: "none", laundry: "none", ...bikeAway(19) })], base, people);
    expect(runaway.closeCall).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Property tests with a seeded generator (no dependency).

function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randomBoard(r: () => number, count = 8): RankPlace[] {
  const pick = <T,>(xs: readonly T[]) => xs[Math.floor(r() * xs.length)]!;
  const maybe = <T,>(v: T) => (r() < 0.15 ? null : v);
  return Array.from({ length: count }, () => {
    const pinned = r() > 0.15;
    return place({
      status: r() < 0.8 ? "considering" : pick(LISTING_STATUSES),
      rentCents: maybe(Math.round(250 + r() * 600) * 1000),
      beds: maybe(Math.floor(r() * 6)),
      baths: maybe(Math.floor(r() * 7) / 2),
      leaseStart: maybe(`2027-0${6 + Math.floor(r() * 4)}-01`),
      parking: maybe(pick(PARKING_OPTIONS)),
      laundry: maybe(pick(LAUNDRY_OPTIONS)),
      ...(pinned ? bikeAway(r() * 25) : { lat: null, lng: null })
    });
  });
}

function randomPriorities(r: () => number): Priorities {
  const level = () => Math.floor(r() * 4) as Level;
  return {
    maxRentPerPersonCents: Math.round(100 + r() * 150) * 1000,
    minBeds: r() < 0.5 ? null : 1 + Math.floor(r() * 4),
    moveInBy: r() < 0.7 ? null : "2027-08-01",
    needsLaundry: r() < 0.3,
    needsParking: r() < 0.3,
    weights: { price: level(), bike: level(), bedrooms: level(), bathrooms: level(), amenities: level() }
  };
}

const scoreOf = (places: RankPlace[], pr: Priorities, id: string) => rankPlaces(places, pr, people).ranked.find((x) => x.place.id === id);

describe("properties (300 random boards each)", () => {
  const runs = Array.from({ length: 300 }, (_, i) => i + 1);

  it("lowering rent never lowers a score", () => {
    for (const seed of runs) {
      const r = rng(seed);
      const board = randomBoard(r);
      const pr = randomPriorities(r);
      for (const x of rankPlaces(board, pr, people).ranked) {
        const cheaper = board.map((p) => (p.id === x.place.id ? { ...p, rentCents: Math.max(0, p.rentCents! - 20000) } : p));
        expect(scoreOf(cheaper, pr, x.place.id)!.score).toBeGreaterThanOrEqual(x.score);
      }
    }
  });

  it("adding a place never changes another place's score", () => {
    for (const seed of runs) {
      const r = rng(seed);
      const board = randomBoard(r);
      const pr = randomPriorities(r);
      const before = rankPlaces(board, pr, people).ranked;
      const after = rankPlaces([...board, ...randomBoard(r, 1)], pr, people).ranked;
      for (const x of before) expect(after.find((y) => y.place.id === x.place.id)!.score).toBe(x.score);
    }
  });

  it("a Don't care factor never changes the order", () => {
    for (const seed of runs) {
      const r = rng(seed);
      const board = randomBoard(r);
      const pr = randomPriorities(r);
      pr.weights.bathrooms = 0;
      if (Object.values(pr.weights).every((w) => w === 0)) pr.weights.price = 1;
      const shuffled = board.map((p) => ({ ...p, baths: Math.floor(r() * 7) / 2 }));
      const ids = (b: RankPlace[]) => rankPlaces(b, pr, people).ranked.map((x) => x.place.id);
      expect(ids(shuffled)).toEqual(ids(board));
    }
  });

  it("failed or unknown requirements are never ranked", () => {
    for (const seed of runs) {
      const r = rng(seed);
      const board = randomBoard(r);
      const pr = randomPriorities(r);
      const res = rankPlaces(board, pr, people);
      const held = new Set([...res.doesntMeet, ...res.missingInfo].map((h) => h.place.id));
      for (const x of res.ranked) {
        expect(held.has(x.place.id)).toBe(false);
        expect(x.place.rentCents).not.toBeNull();
        if (pr.minBeds) expect(x.place.beds).toBeGreaterThanOrEqual(pr.minBeds);
        if (pr.needsLaundry) expect(["in_unit", "on_site"]).toContain(x.place.laundry);
      }
    }
  });

  it("low end ≤ score ≤ high end, ranks in order, and the same input gives the same output", () => {
    for (const seed of runs) {
      const r = rng(seed);
      const board = randomBoard(r);
      const pr = randomPriorities(r);
      const a = rankPlaces(board, pr, people);
      expect(rankPlaces(board, pr, people)).toEqual(a);
      a.ranked.forEach((x, i) => {
        expect(x.lo).toBeLessThanOrEqual(x.score);
        expect(x.score).toBeLessThanOrEqual(x.hi);
        expect(x.rank).toBe(i + 1);
        if (i > 0) expect(a.ranked[i - 1]!.score).toBeGreaterThanOrEqual(x.score);
      });
    }
  });
});
