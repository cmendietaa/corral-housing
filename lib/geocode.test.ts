import { describe, expect, it, vi } from "vitest";
import { addressQuery, geocodeAddress } from "./geocode";

const json = (body: unknown) => Promise.resolve(new Response(JSON.stringify(body), { status: 200 }));
const censusHit = (x: number, y: number) => ({ result: { addressMatches: [{ coordinates: { x, y } }] } });
const censusMiss = { result: { addressMatches: [] } };

describe("addressQuery", () => {
  it("adds Isla Vista to bare street addresses and CA to named towns", () => {
    expect(addressQuery("6545 Trigo Rd")).toBe("6545 Trigo Rd, Isla Vista, CA");
    expect(addressQuery("7150 Calle Real, Goleta")).toBe("7150 Calle Real, Goleta, CA");
    expect(addressQuery("6680 Del Playa Dr, Isla Vista, CA 93117")).toBe("6680 Del Playa Dr, Isla Vista, CA 93117");
  });
  it("skips addresses without a street number", () => {
    expect(addressQuery("near campus")).toBeNull();
    expect(addressQuery("")).toBeNull();
  });
});

describe("geocodeAddress", () => {
  it("uses the Census result when it has one", async () => {
    const f = vi.fn(() => json(censusHit(-119.8559703, 34.4108438)));
    expect(await geocodeAddress("6545 Trigo Rd", f)).toEqual({ lat: 34.410844, lng: -119.85597 });
    expect(f).toHaveBeenCalledTimes(1);
  });
  it("falls back to OpenStreetMap when Census has no match", async () => {
    const f = vi.fn().mockReturnValueOnce(json(censusMiss)).mockReturnValueOnce(json([{ lat: "34.417541", lon: "-119.866698" }]));
    expect(await geocodeAddress("6800 El Colegio Rd", f)).toEqual({ lat: 34.417541, lng: -119.866698 });
  });
  it("rejects results outside Isla Vista and Goleta", async () => {
    const f = vi.fn().mockReturnValueOnce(json(censusHit(-74, 40.7))).mockReturnValueOnce(json([]));
    expect(await geocodeAddress("123 Main St", f)).toBeNull();
  });
  it("returns null when both services fail", async () => {
    const f = vi.fn(() => Promise.reject(new Error("timeout")));
    expect(await geocodeAddress("6545 Trigo Rd", f)).toBeNull();
  });
});
