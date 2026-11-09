import { describe, expect, it } from "vitest";
import { httpUrl } from "./listing";

describe("httpUrl", () => {
  it("accepts http and https links", () => {
    expect(httpUrl.safeParse("https://sb.craigslist.org/apa/123.html").success).toBe(true);
    expect(httpUrl.safeParse("http://example.com").success).toBe(true);
  });
  it("rejects other schemes", () => {
    expect(httpUrl.safeParse("javascript:alert(1)").success).toBe(false);
    expect(httpUrl.safeParse("data:text/html,hi").success).toBe(false);
    expect(httpUrl.safeParse("ftp://example.com").success).toBe(false);
  });
});
