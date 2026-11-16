import { describe, expect, it } from "vitest";
import { emptyListingInput, httpUrl, listingInputSchema, starredFirst } from "./listing";

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

describe("listing link", () => {
  it("is optional, so a place from a screenshot or word of mouth can be saved", () => {
    expect(listingInputSchema.safeParse({ ...emptyListingInput(), title: "Friend's place on Sueno" }).success).toBe(true);
  });
  it("still has to be http(s) when one is given", () => {
    expect(listingInputSchema.safeParse({ ...emptyListingInput(), title: "x", url: "javascript:alert(1)" }).success).toBe(false);
    expect(listingInputSchema.safeParse({ ...emptyListingInput(), title: "x", url: "https://example.com" }).success).toBe(true);
  });
});

describe("starredFirst", () => {
  it("moves starred places to the top and keeps the rest in order", () => {
    const items = [
      { id: "a", starred: false },
      { id: "b", starred: true },
      { id: "c", starred: false },
      { id: "d", starred: true }
    ];
    expect(starredFirst(items).map((x) => x.id)).toEqual(["b", "d", "a", "c"]);
    expect(items.map((x) => x.id)).toEqual(["a", "b", "c", "d"]);
  });
});
