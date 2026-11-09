import { describe, expect, it } from "vitest";
import { distanceKm, mainCluster } from "./map-view";

const iv = [
  { id: "a", lat: 34.41185, lng: -119.85815 },
  { id: "b", lat: 34.40965, lng: -119.86255 },
  { id: "c", lat: 34.41255, lng: -119.86395 },
  { id: "d", lat: 34.41205, lng: -119.85505 }
];
const goleta = { id: "g", lat: 34.43935, lng: -119.82345 };

describe("mainCluster", () => {
  it("opens on the IV cluster and leaves the Goleta outlier for Show all", () => {
    const { cluster, outside } = mainCluster([...iv, goleta]);
    expect(cluster.map((p) => p.id)).toEqual(["a", "b", "c", "d"]);
    expect(outside.map((p) => p.id)).toEqual(["g"]);
  });

  it("keeps everything when there are one or two pins", () => {
    expect(mainCluster([iv[0], goleta]).outside).toHaveLength(0);
  });

  it("falls back to all points when nothing is near the median", () => {
    const spread = [
      { lat: 0, lng: 0 },
      { lat: 1, lng: 1 },
      { lat: 2, lng: 2 },
      { lat: 3, lng: 3 }
    ];
    expect(mainCluster(spread, 0.1).cluster).toHaveLength(4);
  });
});

describe("distanceKm", () => {
  it("is about 4.4 km from IV to the Goleta pin", () => {
    expect(distanceKm(iv[0], goleta)).toBeGreaterThan(4);
    expect(distanceKm(iv[0], goleta)).toBeLessThan(5);
  });
});
