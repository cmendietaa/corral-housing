import { describe, expect, it } from "vitest";
import { bookmarklet, decodeFragment, encodeFragment, readMessage, shortcutScript, type SentPage } from "./payload";

const page: SentPage = { v: 1, url: "https://rlwa.example/listings/1", title: "Studio on Del Playa · Wolfe", text: "$2,750 / MONTH\nStudio · 1 bath\n6531 Del Playa Dr", ld: [], images: [] };

describe("Send to Corral payload", () => {
  it("round-trips through the #p= fragment, including non-ASCII text", () => {
    const withAccents = { ...page, text: page.text + "\nCafé · “quotes” — dash" };
    expect(decodeFragment(`#${encodeFragment(withAccents)}`)).toEqual(withAccents);
  });

  it("refuses fragments that are missing, broken or not a listing page", () => {
    expect(decodeFragment("")).toBeNull();
    expect(decodeFragment("#p=not-base64!!")).toBeNull();
    expect(decodeFragment(`#${encodeFragment({ ...page, url: "javascript:alert(1)" })}`)).toBeNull();
  });

  it("only accepts the bookmark's message shape", () => {
    expect(readMessage({ type: "corral:page", page })).toEqual(page);
    expect(readMessage({ type: "other", page })).toBeNull();
    expect(readMessage("corral:ready")).toBeNull();
    expect(readMessage({ type: "corral:page", page: { ...page, text: 42 } })).toBeNull();
  });

  it("builds a bookmark and a Shortcut script for this Corral", () => {
    const b = bookmarklet("https://corral.example");
    expect(b.startsWith("javascript:")).toBe(true);
    expect(decodeURIComponent(b)).toContain('"https://corral.example"');
    expect(shortcutScript("https://corral.example")).toContain('completion("https://corral.example" + "/send#p=" + b);');
  });
});
