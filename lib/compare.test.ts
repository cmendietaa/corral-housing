import { describe, expect, it } from "vitest";
import { bestIndices, buildComparison, formatRent, meetsBudget, rentPerPerson, sortByRent } from "./compare";

describe("bestIndices", () => {
  it("picks the lowest or highest known value, ties included", () => {
    expect([...bestIndices([5400, null, 5900], "low")]).toEqual([0]);
    expect([...bestIndices([4, 3, 4], "high")]).toEqual([0, 2]);
  });
  it("never marks unknowns, and marks nothing when there's nothing to choose", () => {
    expect([...bestIndices([null, 3], "low")]).toEqual([]);
    expect([...bestIndices([2, 2, null], "high")]).toEqual([]);
  });
});

describe("buildComparison", () => {
  const place = (o: Partial<Parameters<typeof buildComparison>[0][number]>) => ({
    rentCents: null,
    beds: null,
    baths: null,
    leaseStart: null,
    leaseEnd: null,
    parking: null,
    laundry: null,
    nextAction: null,
    nextActionAssignee: null,
    nextActionDue: null,
    ...o
  });
  const rows = buildComparison(
    [
      place({ rentCents: 540000, beds: 4, parking: "driveway", nextAction: "Ask about parking", nextActionAssignee: "maya" }),
      place({ rentCents: null, beds: 3 }),
      place({ rentCents: 590000, beds: 4, parking: "garage" })
    ],
    {
      people: 4,
      budgetPerPersonCents: 140000,
      formatLease: () => "x",
      parkingLabel: (p) => p,
      laundryLabel: (l) => l,
      ownerDue: (p) => (p.nextActionAssignee ? "Maya, Fri" : null)
    }
  );
  const row = (key: string) => rows.find((r) => r.key === key)!;

  it("keeps the fixed row order", () => {
    expect(rows.map((r) => r.label)).toEqual([
      "Rent / mo", "Per person", "Budget", "Bedrooms", "Bathrooms", "Lease", "Parking", "Laundry", "Next step"
    ]);
  });

  it("shows unknown rent as Unknown and never as within budget", () => {
    expect(row("rent").cells[1]).toMatchObject({ text: "Unknown", unknown: true });
    expect(row("budget").cells.map((c) => c.text)).toEqual(["Within budget", "Rent unknown", "Over budget"]);
    expect(row("budget").cells[1].best).toBeUndefined();
  });

  it("highlights the best value per row", () => {
    expect(row("rent").cells.map((c) => Boolean(c.best))).toEqual([true, false, false]);
    expect(row("beds").cells.map((c) => Boolean(c.best))).toEqual([true, false, true]);
    expect(row("parking").cells.map((c) => Boolean(c.best))).toEqual([false, false, true]);
  });

  it("writes the next step with its owner, or None yet", () => {
    expect(row("next").cells.map((c) => c.text)).toEqual(["Ask about parking (Maya, Fri)", "None yet", "None yet"]);
  });
});

const l = (id: string, rentCents: number | null) => ({ id, rentCents });

describe("sortByRent", () => {
  it("sorts cheapest first and puts unknown rent last", () => {
    const out = sortByRent([l("a", null), l("b", 400000), l("c", 0), l("d", 350000)]);
    expect(out.map((x) => x.id)).toEqual(["c", "d", "b", "a"]);
  });

  it("keeps unknown rent last when sorting descending", () => {
    const out = sortByRent([l("a", null), l("b", 400000), l("c", 350000)], "desc");
    expect(out.map((x) => x.id)).toEqual(["b", "c", "a"]);
  });

  it("is stable for ties and multiple unknowns", () => {
    const out = sortByRent([l("a", null), l("b", 100), l("c", null), l("d", 100)]);
    expect(out.map((x) => x.id)).toEqual(["b", "d", "a", "c"]);
  });

  it("does not mutate its input", () => {
    const input = [l("a", 2), l("b", 1)];
    sortByRent(input);
    expect(input.map((x) => x.id)).toEqual(["a", "b"]);
  });
});

describe("meetsBudget", () => {
  it("never passes unknown rent", () => {
    expect(meetsBudget(null, 1_000_000)).toBe(false);
  });
  it("includes rent equal to the budget", () => {
    expect(meetsBudget(500000, 500000)).toBe(true);
    expect(meetsBudget(500001, 500000)).toBe(false);
  });
});

describe("rentPerPerson", () => {
  it("splits evenly, rounding up to the cent", () => {
    expect(rentPerPerson(400000, 4)).toBe(100000);
    expect(rentPerPerson(100000, 3)).toBe(33334);
  });
  it("returns null when anything is unknown or invalid", () => {
    expect(rentPerPerson(null, 4)).toBeNull();
    expect(rentPerPerson(400000, null)).toBeNull();
    expect(rentPerPerson(400000, 0)).toBeNull();
    expect(rentPerPerson(400000, 2.5)).toBeNull();
  });
});

describe("formatRent", () => {
  it("shows Unknown, not $0, for missing rent", () => {
    expect(formatRent(null)).toBe("Unknown");
    expect(formatRent(0)).toBe("$0");
    expect(formatRent(425000)).toBe("$4,250");
  });
});
