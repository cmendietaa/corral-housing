import { describe, expect, it } from "vitest";
import { bearing, roundCoord, streetViewQuery, streetViewSrc } from "./streetview";

describe("streetViewQuery", () => {
  it("accepts IV and Goleta coordinates", () => {
    expect(streetViewQuery.safeParse({ lat: "34.41185", lng: "-119.85815" }).success).toBe(true);
    expect(streetViewQuery.safeParse({ lat: "34.43935", lng: "-119.82345" }).success).toBe(true);
  });

  it("refuses places outside the service area, so the key can't be used as a free proxy", () => {
    expect(streetViewQuery.safeParse({ lat: "40.7128", lng: "-74.006" }).success).toBe(false);
    expect(streetViewQuery.safeParse({ lat: "abc", lng: "-119.85" }).success).toBe(false);
    expect(streetViewQuery.safeParse({}).success).toBe(false);
  });
});

describe("bearing", () => {
  it("points the camera at the place", () => {
    const pano = { lat: 34.4118, lng: -119.8582 };
    expect(bearing(pano, { lat: 34.4128, lng: -119.8582 })).toBe(0); // north
    expect(bearing(pano, { lat: 34.4118, lng: -119.8572 })).toBe(90); // east
    expect(bearing(pano, { lat: 34.4108, lng: -119.8582 })).toBe(180); // south
    expect(bearing(pano, { lat: 34.4118, lng: -119.8592 })).toBe(270); // west
  });
});

describe("streetViewSrc", () => {
  it("builds our own route URL and rounds coordinates", () => {
    expect(streetViewSrc(34.411851234, -119.858151234)).toBe("/api/streetview?lat=34.41185&lng=-119.85815");
    expect(roundCoord(34.4118549)).toBe(34.41185);
  });
  it("has no photo for places without a pin", () => {
    expect(streetViewSrc(null, null)).toBeNull();
  });
});
