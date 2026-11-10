import { describe, expect, it } from "vitest";
import { safeNext } from "./safe-next";

describe("safeNext", () => {
  it("keeps same-site paths", () => {
    expect(safeNext("/boards/abc")).toBe("/boards/abc");
    expect(safeNext("/invite/123?x=1")).toBe("/invite/123?x=1");
  });

  it("refuses anything that could leave the site", () => {
    expect(safeNext("https://evil.example")).toBe("/boards");
    expect(safeNext("//evil.example/path")).toBe("/boards");
    expect(safeNext("/\\evil.example")).toBe("/boards");
    expect(safeNext("javascript:alert(1)")).toBe("/boards");
    expect(safeNext(null)).toBe("/boards");
  });
});
