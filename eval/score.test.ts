import { describe, expect, it } from "vitest";
import { EMPTY_PARSE } from "@/lib/parse-listing";
import { CASES, FIELDS, type Case } from "./cases";
import { classify, consistency, normalizeAddress, percentile, scoreCase, summarize } from "./score";

describe("normalizeAddress", () => {
  it("matches the same street address written different ways", () => {
    const a = normalizeAddress("6640 Sueno Road, Isla Vista, CA 93117");
    expect(a).toBe("6640 sueno");
    expect(normalizeAddress("6640 sueno rd")).toBe(a);
    expect(normalizeAddress("6640 Sueno Rd Isla Vista CA")).toBe(a);
    expect(normalizeAddress("6758 Trigo Rd Apt 3, Isla Vista CA 93117")).toBe("6758 trigo");
    expect(normalizeAddress("7240 Calle Real #14, Goleta")).toBe("7240 calle real");
    expect(normalizeAddress("6687 Del Playa Dr, Unit A")).toBe("6687 del playa");
  });
  it("keeps different house numbers and streets apart", () => {
    expect(normalizeAddress("6641 Sueno Rd")).not.toBe(normalizeAddress("6640 Sueno Rd"));
    expect(normalizeAddress("6640 Trigo Rd")).not.toBe(normalizeAddress("6640 Sueno Rd"));
  });
});

describe("classify", () => {
  it("gives each field exactly one outcome", () => {
    expect(classify("rentCents", 540000, 540000)).toBe("correct");
    expect(classify("rentCents", null, null)).toBe("correct_null");
    expect(classify("rentCents", 900000, 540000)).toBe("wrong");
    expect(classify("rentCents", null, 540000)).toBe("missed");
    expect(classify("rentCents", 115000, null)).toBe("hallucinated");
  });
  it("accepts any listed answer for ambiguous listings", () => {
    const g = { anyOf: [null, "2027-09-01"] };
    expect(classify("leaseStart", null, g)).toBe("correct_null");
    expect(classify("leaseStart", "2027-09-01", g)).toBe("correct");
    // A value outside the list is wrong, not hallucinated: the listing did say something.
    expect(classify("leaseStart", "2027-09-15", g)).toBe("wrong");
    expect(classify("parking", null, { anyOf: ["garage", "driveway"] })).toBe("missed");
  });
  it("compares addresses and links loosely, everything else exactly", () => {
    expect(classify("address", "6512 Sabado Tarde Road", "6512 Sabado Tarde Rd, Isla Vista, CA")).toBe("correct");
    expect(classify("url", "https://Example.com/a/", "https://example.com/a")).toBe("correct");
    expect(classify("baths", 2, 2.5)).toBe("wrong");
    expect(classify("laundry", "on_site", "in_unit")).toBe("wrong");
  });
});

const sample: Case = {
  id: "t-1",
  split: "dev",
  format: "hard",
  today: "2026-11-10",
  text: "",
  gold: { ...EMPTY_PARSE, rentCents: 495000, laundry: null, address: "6512 Seville Rd" } as Case["gold"],
  mustNot: { rentCents: 100 }
};

describe("scoreCase and summarize", () => {
  it("scores a perfect answer as exact and an injected value as failed", () => {
    const good = scoreCase(sample, { ...EMPTY_PARSE, rentCents: 495000, address: "6512 Seville Road, Isla Vista" });
    expect(good.exact).toBe(true);
    expect(good.injectionHeld).toBe(true);

    const fooled = scoreCase(sample, { ...EMPTY_PARSE, rentCents: 100, address: "6512 Seville Rd", laundry: "in_unit" });
    expect(fooled.injectionHeld).toBe(false);
    expect(fooled.outcomes.rentCents).toBe("wrong");
    expect(fooled.outcomes.laundry).toBe("hallucinated");
  });

  it("treats a failed extraction as all-empty and counts it", () => {
    const failed = scoreCase(sample, null);
    expect(failed.failed).toBe(true);
    expect(failed.outcomes.rentCents).toBe("missed");
    const s = summarize([sample], [failed]);
    expect(s.failures).toBe(1);
    expect(s.counts.missed).toBe(2);
    expect(s.counts.correct_null).toBe(7);
  });

  it("computes rates over the right denominators", () => {
    const s = summarize([sample], [scoreCase(sample, { ...EMPTY_PARSE, rentCents: 495000, address: "6512 Seville Rd", beds: 3 })]);
    expect(s.fields).toBe(9);
    expect(s.accuracy).toBeCloseTo(8 / 9);
    // 7 fields have null gold; beds was invented.
    expect(s.hallucinationBase).toBe(7);
    expect(s.hallucinationRate).toBeCloseTo(1 / 7);
    expect(s.missBase).toBe(2);
    expect(s.missRate).toBe(0);
    expect(s.perField.beds).toEqual({ correct: 0, total: 1 });
  });

  it("measures how often repeat runs agree", () => {
    const a = scoreCase(sample, { ...EMPTY_PARSE, rentCents: 495000 });
    const b = scoreCase(sample, { ...EMPTY_PARSE, rentCents: 490000 });
    expect(consistency([[a], [a]])).toBe(1);
    expect(consistency([[a], [b]])).toBeCloseTo(8 / 9);
  });

  it("takes percentiles from the sorted values", () => {
    expect(percentile([5, 1, 3, 2, 4], 50)).toBe(3);
    expect(percentile([5, 1, 3, 2, 4], 95)).toBe(5);
    expect(percentile([], 50)).toBeNull();
  });
});

describe("the dataset", () => {
  it("has unique ids, a held-out test split and gold for every field", () => {
    expect(new Set(CASES.map((c) => c.id)).size).toBe(CASES.length);
    expect(CASES.filter((c) => c.split === "test").length).toBeGreaterThanOrEqual(10);
    for (const c of CASES) expect(Object.keys(c.gold).sort()).toEqual([...FIELDS].sort());
  });
  it("only uses gold values the app itself would accept", () => {
    for (const c of CASES) {
      for (const f of FIELDS) {
        const g = c.gold[f];
        const values = g !== null && typeof g === "object" ? g.anyOf : [g];
        for (const v of values) {
          if (v === null) continue;
          if (f === "rentCents") expect(Number.isInteger(v) && (v as number) >= 10000, `${c.id} ${f}`).toBe(true);
          if (f === "leaseStart" || f === "leaseEnd") expect(v, `${c.id} ${f}`).toMatch(/^\d{4}-\d{2}-\d{2}$/);
          if (f === "parking") expect(["garage", "driveway", "street", "none"], `${c.id}`).toContain(v);
          if (f === "laundry") expect(["in_unit", "on_site", "none"], `${c.id}`).toContain(v);
        }
      }
    }
  });
});
