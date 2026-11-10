import { describe, expect, it } from "vitest";
import { commuteToCampus, formatCommute } from "./commute";

describe("commuteToCampus", () => {
  it("is null without a pin", () => {
    expect(commuteToCampus(null, -119.86)).toBeNull();
    expect(formatCommute(null)).toBeNull();
  });
  it("puts Isla Vista a few minutes' bike ride away", () => {
    const c = commuteToCampus(34.4112, -119.8602)!; // Sabado Tarde
    expect(c.bikeMin).toBeLessThanOrEqual(4);
    expect(c.walkMin).toBeGreaterThan(c.bikeMin);
  });
  it("puts Goleta farther than Isla Vista", () => {
    const iv = commuteToCampus(34.4112, -119.8602)!;
    const goleta = commuteToCampus(34.4366, -119.8661)!; // Calle Real
    expect(goleta.bikeMin).toBeGreaterThan(iv.bikeMin);
  });
});
