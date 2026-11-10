import { describe, expect, it } from "vitest";
import { areaLabel, parseStreet, streetHeadline } from "./address";

describe("parseStreet", () => {
  it("drops the suffix from multi-word streets", () => {
    expect(parseStreet("6512 Sabado Tarde Rd, Isla Vista")).toEqual({ street: "Sabado Tarde", number: "6512" });
    expect(parseStreet("6680 Del Playa Dr., Isla Vista")).toEqual({ street: "Del Playa", number: "6680" });
  });

  it("keeps a short suffix on one-word streets so they still read as streets", () => {
    expect(parseStreet("6545 Trigo Rd, Isla Vista")).toEqual({ street: "Trigo Rd", number: "6545" });
    expect(parseStreet("6550 Pardall Road")).toEqual({ street: "Pardall Rd", number: "6550" });
  });

  it("handles streets without a number or with unit notes", () => {
    expect(parseStreet("Embarcadero del Norte, Isla Vista (unit TBD)")).toEqual({
      street: "Embarcadero del Norte",
      number: null
    });
    expect(parseStreet("6745 Trigo Rd #B")).toEqual({ street: "Trigo Rd", number: "6745" });
    expect(parseStreet("7150 Calle Real, Goleta")).toEqual({ street: "Calle Real", number: "7150" });
  });

  it("returns nulls for empty input", () => {
    expect(parseStreet(null)).toEqual({ street: null, number: null });
    expect(parseStreet("  ")).toEqual({ street: null, number: null });
  });
});

describe("streetHeadline", () => {
  it("leads with the street", () => {
    expect(streetHeadline("6512 Sabado Tarde Rd, Isla Vista", "Blue duplex")).toBe("Sabado Tarde, 6512");
    expect(streetHeadline("6545 Trigo Rd, Isla Vista", "Upstairs 3BR")).toBe("Trigo Rd, 6545");
  });
  it("falls back to the title", () => {
    expect(streetHeadline(null, "Camino Pescadero studio")).toBe("Camino Pescadero studio");
  });
});

describe("areaLabel", () => {
  it("reads the city part of the address", () => {
    expect(areaLabel("6512 Sabado Tarde Rd, Isla Vista")).toBe("IV");
    expect(areaLabel("7150 Calle Real, Goleta")).toBe("Goleta");
    expect(areaLabel("6512 Sabado Tarde Rd")).toBeNull();
    expect(areaLabel(null)).toBeNull();
  });
});
