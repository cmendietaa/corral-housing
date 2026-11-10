import { describe, expect, it } from "vitest";
import { formatBedsBaths, formatCount, formatDueShort, formatLeasePhrase, formatRentShort, parseDollars } from "./format";

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

describe("formatDueShort", () => {
  const monday = new Date("2026-11-09T12:00:00");
  it("uses the weekday within the week and the date after that", () => {
    expect(formatDueShort("2026-11-13", monday)).toEqual({ text: "Fri", overdue: false });
    expect(formatDueShort("2026-11-09", monday)).toEqual({ text: "Today", overdue: false });
    expect(formatDueShort("2026-11-21", monday)).toEqual({ text: "Nov 21", overdue: false });
  });
  it("flags overdue dates", () => {
    expect(formatDueShort("2026-11-07", monday)).toEqual({ text: "Overdue · Nov 7", overdue: true });
  });
});

describe("formatBedsBaths", () => {
  it("leaves out unknowns", () => {
    expect(formatBedsBaths(4, 2.5)).toBe("4 bd · 2.5 ba");
    expect(formatBedsBaths(3, null)).toBe("3 bd");
    expect(formatBedsBaths(null, null)).toBe("");
  });
});

describe("card meta", () => {
  it("names unknowns plainly", () => {
    expect(formatCount(null, "bed")).toBe("Beds unknown");
    expect(formatCount(1, "bath")).toBe("1 bath");
    expect(formatLeasePhrase(null, null)).toBe("Lease dates unknown");
  });
});
