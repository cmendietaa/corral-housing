import { describe, expect, it } from "vitest";
import { fitWithin } from "./photo-shrink";

describe("fitWithin", () => {
  it("scales the longest side down to the limit, keeping the shape", () => {
    expect(fitWithin(4032, 3024)).toEqual({ width: 1600, height: 1200 });
    expect(fitWithin(3024, 4032)).toEqual({ width: 1200, height: 1600 });
  });
  it("never upscales small photos", () => {
    expect(fitWithin(800, 600)).toEqual({ width: 800, height: 600 });
  });
  it("handles a custom limit and empty images", () => {
    expect(fitWithin(2000, 1000, 1000)).toEqual({ width: 1000, height: 500 });
    expect(fitWithin(0, 100)).toEqual({ width: 0, height: 0 });
  });
});
