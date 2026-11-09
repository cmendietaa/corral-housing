import { describe, expect, it } from "vitest";
import { formatCount, formatLeasePhrase, formatRentShort, parseDollars } from "./format";

describe("formatRentShort", () => {
  it("abbreviates thousands to one decimal", () => {
    expect(formatRentShort(540000)).toBe("$5.4k");
    expect(formatRentShort(690000)).toBe("$6.9k");
    expect(formatRentShort(600000)).toBe("$6k");
    expect(formatRentShort(95000)).toBe("$950");
  });
  it("shows a question mark for unknown rent, never $0", () => {
    expect(formatRentShort(null)).toBe("$?");
  });
});

describe("parseDollars", () => {
  it("accepts common ways of typing rent", () => {
    expect(parseDollars("$5,400")).toBe(540000);
    expect(parseDollars("5400.5")).toBe(540050);
    expect(parseDollars("")).toBeNull();
    expect(parseDollars("about 5k")).toBeNaN();
  });
});

describe("card meta", () => {
  it("names unknowns plainly", () => {
    expect(formatCount(null, "bed")).toBe("Beds unknown");
    expect(formatCount(1, "bath")).toBe("1 bath");
    expect(formatLeasePhrase(null, null)).toBe("Lease dates unknown");
  });
});
