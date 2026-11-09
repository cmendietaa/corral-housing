import { describe, expect, it } from "vitest";
import { parseStreet, streetGroup, streetHeadline } from "./address";

describe("parseStreet", () => {
  it("splits number and street and drops the suffix and city", () => {
    expect(parseStreet("6512 Sabado Tarde Rd, Isla Vista")).toEqual({ street: "Sabado Tarde", number: "6512" });
    expect(parseStreet("6681 Del Playa Dr.")).toEqual({ street: "Del Playa", number: "6681" });
  });

  it("handles streets without a number or with unit notes", () => {
    expect(parseStreet("Embarcadero del Norte, Isla Vista (unit TBD)")).toEqual({
      street: "Embarcadero del Norte",
      number: null
    });
    expect(parseStreet("6745 Trigo Rd #B")).toEqual({ street: "Trigo", number: "6745" });
    expect(parseStreet("Calle Real, Goleta")).toEqual({ street: "Calle Real", number: null });
  });

  it("does not strip a one-word street that looks like a suffix", () => {
    expect(parseStreet("12 Way")).toEqual({ street: "Way", number: "12" });
  });

  it("returns nulls for empty input", () => {
    expect(parseStreet(null)).toEqual({ street: null, number: null });
    expect(parseStreet("  ")).toEqual({ street: null, number: null });
  });
});

describe("streetHeadline", () => {
  it("leads with the street", () => {
    expect(streetHeadline("6512 Sabado Tarde Rd, Isla Vista", "4-bed")).toBe("Sabado Tarde, 6512");
    expect(streetHeadline("Calle Real, Goleta", "House")).toBe("Calle Real");
  });
  it("falls back to the title", () => {
    expect(streetHeadline(null, "Camino Pescadero studio")).toBe("Camino Pescadero studio");
  });
});

describe("streetGroup", () => {
  it("groups places without an address together", () => {
    expect(streetGroup(null)).toBe("No address yet");
    expect(streetGroup("6559 Picasso Rd")).toBe("Picasso");
  });
});
