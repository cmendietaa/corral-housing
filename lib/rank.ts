import { commuteToCampus } from "./commute";
import { formatRent, rentPerPerson } from "./compare";
import { isClosedStatus, type Listing } from "./listing";

/**
 * Explainable ranking for the Rank tab. Pure and deterministic, no AI.
 *
 * 1. Requirements are three-valued (pass / fail / unknown). A failed one moves a
 *    place to "doesn't meet"; an unknown one moves it to "missing info". Neither
 *    is ever ranked: we can't claim a place fits when we can't check it.
 * 2. Each preference factor becomes a 0–1 score against FIXED reference points
 *    (not min–max over the board), so a place's score never depends on which
 *    other places are on the board.
 * 3. Unknown values in a preference give a range (unknown = 0 at the low end,
 *    1 at the high end). Places rank by the middle of the range.
 * 4. Explanations are generated from the numbers and only ever state known values.
 *
 * The rules are written up in docs/ranking.md.
 */

export type RankPlace = Pick<
  Listing,
  "id" | "title" | "status" | "rentCents" | "beds" | "baths" | "leaseStart" | "parking" | "laundry" | "lat" | "lng"
>;

export const FACTORS = ["price", "bike", "bedrooms", "bathrooms", "amenities"] as const;
export type Factor = (typeof FACTORS)[number];

export const FACTOR_LABELS: Record<Factor, string> = {
  price: "Price per person",
  bike: "Bike time to campus",
  bedrooms: "Bedrooms per person",
  bathrooms: "Bathrooms per person",
  amenities: "Parking & laundry"
};

/** 0 Don't care · 1 A little · 2 Important · 3 Very. */
export type Level = 0 | 1 | 2 | 3;
export const LEVEL_LABELS = ["Don't care", "A little", "Important", "Very"] as const;
/** "Very" counts double "Important", so one factor can clearly dominate. */
const LEVEL_WEIGHT = [0, 1, 2, 4] as const;

export type Priorities = {
  /** Hard maximum rent per person in cents, or null for no limit. */
  maxRentPerPersonCents: number | null;
  minBeds: number | null;
  /** ISO date: the lease must start on or before it. */
  moveInBy: string | null;
  needsLaundry: boolean;
  /** Off-street: garage or driveway/lot. */
  needsParking: boolean;
  weights: Record<Factor, Level>;
};

export const DEFAULT_WEIGHTS: Record<Factor, Level> = { price: 3, bike: 2, bedrooms: 2, bathrooms: 1, amenities: 1 };

/** Defaults from the board: its budget as the max, and a bedroom per person. */
export function defaultPriorities(board: { budgetPerPersonCents: number | null; people: number | null }): Priorities {
  return {
    maxRentPerPersonCents: board.budgetPerPersonCents,
    minBeds: board.people && board.people > 0 ? board.people : null,
    moveInBy: null,
    needsLaundry: false,
    needsParking: false,
    weights: { ...DEFAULT_WEIGHTS }
  };
}

// ---------------------------------------------------------------------------
// Requirements

export const REQUIREMENTS = ["maxRent", "minBeds", "moveInBy", "laundry", "parking"] as const;
export type Requirement = (typeof REQUIREMENTS)[number];
type Check = { requirement: Requirement; result: "pass" | "fail" | "unknown"; text: string };

const dateFmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const fmtDate = (iso: string) => dateFmt.format(new Date(`${iso}T00:00:00Z`));
const plural = (n: number, noun: string) => `${n} ${noun}${n === 1 ? "" : "s"}`;

function checkRequirements(p: RankPlace, pr: Priorities, people: number | null): Check[] {
  const checks: Check[] = [];
  if (pr.maxRentPerPersonCents !== null) {
    const pp = rentPerPerson(p.rentCents, people);
    checks.push(
      pp === null
        ? { requirement: "maxRent", result: "unknown", text: p.rentCents === null ? "Rent unknown" : "Rent per person unknown (no group size)" }
        : pp > pr.maxRentPerPersonCents
          ? { requirement: "maxRent", result: "fail", text: `${formatRent(pp)}/person is over your ${formatRent(pr.maxRentPerPersonCents)} max` }
          : { requirement: "maxRent", result: "pass", text: "" }
    );
  }
  if (pr.minBeds !== null && pr.minBeds > 0) {
    checks.push(
      p.beds === null
        ? { requirement: "minBeds", result: "unknown", text: "Bedrooms unknown" }
        : p.beds < pr.minBeds
          ? { requirement: "minBeds", result: "fail", text: `${p.beds === 0 ? "Studio" : plural(p.beds, "bedroom")}, you need ${pr.minBeds}` }
          : { requirement: "minBeds", result: "pass", text: "" }
    );
  }
  if (pr.moveInBy !== null) {
    checks.push(
      p.leaseStart === null
        ? { requirement: "moveInBy", result: "unknown", text: "Start date unknown" }
        : p.leaseStart > pr.moveInBy
          ? { requirement: "moveInBy", result: "fail", text: `Starts ${fmtDate(p.leaseStart)}, after your ${fmtDate(pr.moveInBy)}` }
          : { requirement: "moveInBy", result: "pass", text: "" }
    );
  }
  if (pr.needsLaundry) {
    checks.push(
      p.laundry === null
        ? { requirement: "laundry", result: "unknown", text: "Laundry unknown" }
        : p.laundry === "none"
          ? { requirement: "laundry", result: "fail", text: "No laundry" }
          : { requirement: "laundry", result: "pass", text: "" }
    );
  }
  if (pr.needsParking) {
    checks.push(
      p.parking === null
        ? { requirement: "parking", result: "unknown", text: "Parking unknown" }
        : p.parking === "street" || p.parking === "none"
          ? { requirement: "parking", result: "fail", text: p.parking === "street" ? "Street parking only" : "No parking" }
          : { requirement: "parking", result: "pass", text: "" }
    );
  }
  return checks;
}

// ---------------------------------------------------------------------------
// Factor scores

/** A factor score as a range: lo === hi when fully known. */
export type FactorScore = { lo: number; hi: number; known: "yes" | "partial" | "no" };

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const UNKNOWN_SCORE: FactorScore = { lo: 0, hi: 1, known: "no" };
const exact = (x: number): FactorScore => ({ lo: clamp01(x), hi: clamp01(x), known: "yes" });

/** 1 at or under `good`, 0 at or over `bad`, linear in between. */
const lowerIsBetter = (x: number, good: number, bad: number) => clamp01((bad - x) / (bad - good));

/** 1 at `full` or more, `mid`-score at `half`, 0 at 0; linear on each piece. */
function perPerson(ratio: number, full: number, half: number, mid = 0.3) {
  if (ratio >= full) return 1;
  if (ratio >= half) return mid + ((ratio - half) / (full - half)) * (1 - mid);
  return (ratio / half) * mid;
}

export const PARKING_SCORE = { garage: 1, driveway: 0.8, street: 0.3, none: 0 } as const;
export const LAUNDRY_SCORE = { in_unit: 1, on_site: 0.6, none: 0 } as const;

/** Reference points; see docs/ranking.md. */
export const REF = {
  /** Price scores 1 at or under this share of the max, 0 at the max. */
  priceGoodShare: 0.6,
  bikeGoodMin: 5,
  bikeBadMin: 20,
  bedsFull: 1,
  bedsHalf: 0.5,
  bathsFull: 0.5,
  bathsHalf: 0.25
} as const;

type Context = { people: number | null; priceRef: number | null };

function factorScores(p: RankPlace, ctx: Context): Record<Factor, FactorScore> {
  const pp = rentPerPerson(p.rentCents, ctx.people);
  const bike = commuteToCampus(p.lat, p.lng);
  const people = ctx.people;

  let amenities: FactorScore;
  const park = p.parking === null ? null : PARKING_SCORE[p.parking];
  const laund = p.laundry === null ? null : LAUNDRY_SCORE[p.laundry];
  if (park !== null && laund !== null) amenities = exact((park + laund) / 2);
  else if (park === null && laund === null) amenities = UNKNOWN_SCORE;
  else {
    const k = (park ?? laund)!;
    amenities = { lo: k / 2, hi: (k + 1) / 2, known: "partial" };
  }

  return {
    price:
      pp === null || ctx.priceRef === null
        ? UNKNOWN_SCORE
        : exact(lowerIsBetter(pp, REF.priceGoodShare * ctx.priceRef, ctx.priceRef)),
    bike: bike === null ? UNKNOWN_SCORE : exact(lowerIsBetter(bike.bikeMin, REF.bikeGoodMin, REF.bikeBadMin)),
    bedrooms: p.beds === null || !people ? UNKNOWN_SCORE : exact(perPerson(p.beds / people, REF.bedsFull, REF.bedsHalf)),
    bathrooms: p.baths === null || !people ? UNKNOWN_SCORE : exact(perPerson(p.baths / people, REF.bathsFull, REF.bathsHalf)),
    amenities
  };
}

/** Normalized weights summing to 1. All "Don't care" falls back to price alone. */
export function normalizeWeights(levels: Record<Factor, Level>): { weights: Record<Factor, number>; allDontCare: boolean } {
  const raw: number[] = FACTORS.map((f) => LEVEL_WEIGHT[levels[f]]);
  const total = raw.reduce((a, b) => a + b, 0);
  if (total === 0) {
    return { weights: { price: 1, bike: 0, bedrooms: 0, bathrooms: 0, amenities: 0 }, allDontCare: true };
  }
  return { weights: Object.fromEntries(FACTORS.map((f, i) => [f, raw[i]! / total])) as Record<Factor, number>, allDontCare: false };
}

// ---------------------------------------------------------------------------
// Explanations

export type Reason = { factor: Factor; sign: "+" | "-"; text: string };

function factorFact(f: Factor, p: RankPlace, people: number | null, maxRent: number | null): string | null {
  switch (f) {
    case "price": {
      const pp = rentPerPerson(p.rentCents, people);
      if (pp === null) return null;
      if (maxRent === null) return `${formatRent(pp)}/person`;
      const under = maxRent - pp;
      return under > 0 ? `${formatRent(pp)}/person, ${formatRent(under)} under your max` : `${formatRent(pp)}/person, right at your max`;
    }
    case "bike": {
      const c = commuteToCampus(p.lat, p.lng);
      return c ? `about ${c.bikeMin} min bike to campus` : null;
    }
    case "bedrooms":
      return p.beds === null || !people ? null : `${p.beds === 0 ? "studio" : plural(p.beds, "bedroom")} for ${plural(people, "person").replace("persons", "people")}`;
    case "bathrooms":
      return p.baths === null || !people ? null : `${plural(p.baths, "bath")} for ${plural(people, "person").replace("persons", "people")}`;
    case "amenities": {
      const parts = [
        p.laundry === null ? null : { in_unit: "in-unit laundry", on_site: "laundry on site", none: "no laundry" }[p.laundry],
        p.parking === null ? null : { garage: "garage", driveway: "off-street parking", street: "street parking only", none: "no parking" }[p.parking]
      ].filter(Boolean);
      return parts.length ? parts.join(", ") : null;
    }
  }
}

/** Phrase for "why it's below the place above", using both places' known values. */
function gapPhrase(f: Factor, a: RankPlace, above: RankPlace, people: number | null): string | null {
  switch (f) {
    case "price": {
      const x = rentPerPerson(a.rentCents, people);
      const y = rentPerPerson(above.rentCents, people);
      return x !== null && y !== null && x > y ? `it's ${formatRent(x - y)}/person more` : null;
    }
    case "bike": {
      const x = commuteToCampus(a.lat, a.lng);
      const y = commuteToCampus(above.lat, above.lng);
      return x && y && x.bikeMin > y.bikeMin ? `it's about ${x.bikeMin - y.bikeMin} min farther by bike` : null;
    }
    case "bedrooms":
      return a.beds !== null && above.beds !== null && a.beds < above.beds ? `it has fewer bedrooms (${a.beds} vs ${above.beds})` : null;
    case "bathrooms":
      return a.baths !== null && above.baths !== null && a.baths < above.baths ? `it has fewer bathrooms (${a.baths} vs ${above.baths})` : null;
    case "amenities":
      return "of parking and laundry";
  }
}

const WIN_LABEL: Record<Factor, string> = {
  price: "price",
  bike: "bike time",
  bedrooms: "bedrooms",
  bathrooms: "bathrooms",
  amenities: "parking and laundry"
};

// ---------------------------------------------------------------------------
// Ranking

export type RankedPlace<T extends RankPlace = RankPlace> = {
  place: T;
  rank: number;
  /** 0–100, the middle of the range. */
  score: number;
  lo: number;
  hi: number;
  factors: Record<Factor, FactorScore>;
  /** Each factor's share of the score (weight × middle × 100), for the stacked bar. */
  contributions: Record<Factor, number>;
  /** Weighted factors we couldn't score. */
  missing: Factor[];
  /** Up to two strongest pluses, then the strongest minus. The card shows the first + and the -. */
  reasons: Reason[];
  /** Each factor's known value in words, for the "Why?" breakdown (null when unknown). */
  facts: Record<Factor, string | null>;
  /** "Ranks below X mainly because …", for rank 2 and lower. */
  vsAbove: string | null;
};

export type HeldPlace<T extends RankPlace = RankPlace> = { place: T; reasons: string[]; requirements: Requirement[] };

export type Ranking<T extends RankPlace = RankPlace> = {
  ranked: RankedPlace<T>[];
  /** A requirement can't be checked (and none failed). */
  missingInfo: HeldPlace<T>[];
  /** At least one requirement failed. */
  doesntMeet: HeldPlace<T>[];
  /** When nothing ranks: the requirement excluding the most places. */
  tightest: Requirement | null;
  /** A one-step weight change that would change #1. */
  closeCall: Factor | null;
  allDontCare: boolean;
  /** Bike time is weighted but no candidate has a pin. */
  noPins: boolean;
  /** Price is scored against the board median because there's no max. */
  priceRef: number | null;
};

/** "8.6", or "~7.5" when a weighted factor is unknown (the card adds "/10"). */
export function formatScore(r: Pick<RankedPlace, "score" | "missing">): string {
  const ten = (Math.round(r.score) / 10).toFixed(1);
  return r.missing.length ? `~${ten}` : ten;
}

/** The card's one line: the strongest plus and the strongest minus. */
export function headline(r: Pick<RankedPlace, "reasons">): Reason[] {
  const plus = r.reasons.find((x) => x.sign === "+");
  const minus = r.reasons.find((x) => x.sign === "-");
  return [plus, minus].filter((x): x is Reason => Boolean(x));
}

function median(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
}

const round1 = (x: number) => Math.round(x * 10) / 10;

export function rankPlaces<T extends RankPlace>(places: readonly T[], priorities: Priorities, people: number | null): Ranking<T> {
  const groupSize = people && people > 0 ? people : null;
  const open = places.filter((p) => !isClosedStatus(p.status));

  const passing: T[] = [];
  const missingInfo: HeldPlace<T>[] = [];
  const doesntMeet: HeldPlace<T>[] = [];
  const failCount = new Map<Requirement, number>();
  for (const p of open) {
    const checks = checkRequirements(p, priorities, groupSize);
    const fails = checks.filter((c) => c.result === "fail");
    const unknowns = checks.filter((c) => c.result === "unknown");
    if (fails.length) {
      doesntMeet.push({ place: p, reasons: fails.map((c) => c.text), requirements: fails.map((c) => c.requirement) });
      for (const c of fails) failCount.set(c.requirement, (failCount.get(c.requirement) ?? 0) + 1);
    } else if (unknowns.length) {
      missingInfo.push({ place: p, reasons: unknowns.map((c) => c.text), requirements: unknowns.map((c) => c.requirement) });
    } else passing.push(p);
  }

  // Fixed reference: the max. Without one, the median of the open places is the
  // only sensible scale (documented: then a price score does depend on the board).
  const priceRef =
    priorities.maxRentPerPersonCents ??
    median(open.map((p) => rentPerPerson(p.rentCents, groupSize)).filter((x): x is number => x !== null));

  const ctx: Context = { people: groupSize, priceRef };
  const scored = passing.map((place, index) => ({ place, index, factors: factorScores(place, ctx) }));

  const order = (levels: Record<Factor, Level>) => {
    const { weights } = normalizeWeights(levels);
    return scored
      .map((s) => {
        let lo = 0;
        let hi = 0;
        for (const f of FACTORS) {
          lo += weights[f] * s.factors[f].lo;
          hi += weights[f] * s.factors[f].hi;
        }
        return { ...s, lo: lo * 100, hi: hi * 100, mid: ((lo + hi) / 2) * 100, weights };
      })
      .sort(
        (a, b) =>
          b.mid - a.mid ||
          b.lo - a.lo ||
          (rentPerPerson(a.place.rentCents, groupSize) ?? Infinity) - (rentPerPerson(b.place.rentCents, groupSize) ?? Infinity) ||
          a.index - b.index
      );
  };

  const { allDontCare } = normalizeWeights(priorities.weights);
  const sorted = order(priorities.weights);

  const ranked: RankedPlace<T>[] = sorted.map((s, i) => {
    const contributions = Object.fromEntries(
      FACTORS.map((f) => [f, s.weights[f] * ((s.factors[f].lo + s.factors[f].hi) / 2) * 100])
    ) as Record<Factor, number>;
    const missing = FACTORS.filter((f) => s.weights[f] > 0 && s.factors[f].known !== "yes");

    // Strongest pulls from neutral (0.5), known factors only.
    const pulls = FACTORS.filter((f) => s.weights[f] > 0 && s.factors[f].known === "yes")
      .map((f) => ({ f, pull: s.weights[f] * (s.factors[f].lo - 0.5) }))
      .filter((x) => Math.abs(x.pull) > 1e-9);
    const pos = pulls.filter((x) => x.pull > 0).sort((a, b) => b.pull - a.pull).slice(0, 2);
    const neg = pulls.filter((x) => x.pull < 0).sort((a, b) => a.pull - b.pull).slice(0, 1);
    const reasons: Reason[] = [];
    for (const { f } of pos) {
      const text = factorFact(f, s.place, groupSize, priorities.maxRentPerPersonCents);
      if (text) reasons.push({ factor: f, sign: "+", text });
    }
    for (const { f } of neg) {
      const text = factorFact(f, s.place, groupSize, priorities.maxRentPerPersonCents);
      if (text) reasons.push({ factor: f, sign: "-", text });
    }

    let vsAbove: string | null = null;
    const above = sorted[i - 1];
    if (above) {
      // Split the score gap into per-factor differences, comparing only factors known on both.
      const diffs = FACTORS.filter((f) => s.weights[f] > 0 && s.factors[f].known === "yes" && above.factors[f].known === "yes").map((f) => ({
        f,
        d: s.weights[f] * (s.factors[f].lo - above.factors[f].lo)
      }));
      const lose = diffs.filter((x) => x.d < -1e-9).sort((a, b) => a.d - b.d)[0];
      const win = diffs.filter((x) => x.d > 1e-9).sort((a, b) => b.d - a.d)[0];
      const phrase = lose ? gapPhrase(lose.f, s.place, above.place, groupSize) : null;
      if (phrase) {
        vsAbove = `Ranks below ${above.place.title} mainly because ${phrase}${win ? `; it wins on ${WIN_LABEL[win.f]}` : ""}.`;
      } else if (missing.length) {
        vsAbove = `Ranks below ${above.place.title} partly because its ${missing.map((f) => WIN_LABEL[f]).join(" and ")} ${missing.length > 1 ? "are" : "is"} unknown.`;
      }
    }

    return {
      place: s.place,
      rank: i + 1,
      score: round1(s.mid),
      lo: round1(s.lo),
      hi: round1(s.hi),
      factors: s.factors,
      contributions,
      missing,
      reasons,
      facts: Object.fromEntries(FACTORS.map((f) => [f, factorFact(f, s.place, groupSize, priorities.maxRentPerPersonCents)])) as Record<Factor, string | null>,
      vsAbove
    };
  });

  // Close call: does moving any one weight one step change #1?
  let closeCall: Factor | null = null;
  if (sorted.length >= 2) {
    const top = sorted[0]!.place.id;
    outer: for (const f of FACTORS) {
      for (const step of [-1, 1]) {
        const level = priorities.weights[f] + step;
        if (level < 0 || level > 3) continue;
        const alt = order({ ...priorities.weights, [f]: level as Level });
        if (alt[0]!.place.id !== top) {
          closeCall = f;
          break outer;
        }
      }
    }
  }

  let tightest: Requirement | null = null;
  if (!ranked.length && failCount.size) {
    tightest = [...failCount.entries()].sort((a, b) => b[1] - a[1] || REQUIREMENTS.indexOf(a[0]) - REQUIREMENTS.indexOf(b[0]))[0]![0];
  }

  const noPins = !allDontCare && priorities.weights.bike > 0 && passing.length > 0 && passing.every((p) => p.lat === null || p.lng === null);

  return { ranked, missingInfo, doesntMeet, tightest, closeCall, allDontCare, noPins, priceRef };
}
