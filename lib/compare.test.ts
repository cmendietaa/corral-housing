import { describe, expect, it } from "vitest";
import { formatRent, meetsBudget, rentPerPerson, sortByRent } from "./compare";

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
