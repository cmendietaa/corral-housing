import { describe, expect, it } from "vitest";
import { robotsAllows } from "./robots";

const UA = "CorralLinkPreview";

describe("robotsAllows", () => {
  it("allows everything when there are no rules", () => {
    expect(robotsAllows("", "/listing/1", UA)).toBe(true);
    expect(robotsAllows("User-agent: *\nDisallow:", "/listing/1", UA)).toBe(true);
  });

  it("follows the * group", () => {
    const txt = "User-agent: *\nDisallow: /private/\nDisallow: /search";
    expect(robotsAllows(txt, "/private/x", UA)).toBe(false);
    expect(robotsAllows(txt, "/search?q=4br", UA)).toBe(false);
    expect(robotsAllows(txt, "/rentals/6512-sabado", UA)).toBe(true);
  });

  it("lets the longest rule win, with Allow on a tie", () => {
    const txt = "User-agent: *\nDisallow: /homes/\nAllow: /homes/for_rent/$\nAllow: /homes/listing\nDisallow: /homes/listing";
    expect(robotsAllows(txt, "/homes/for_rent/", UA)).toBe(true);
    expect(robotsAllows(txt, "/homes/for_rent/page2", UA)).toBe(false);
    expect(robotsAllows(txt, "/homes/listing/9", UA)).toBe(true);
  });

  it("supports * wildcards in paths", () => {
    const txt = "User-agent: *\nDisallow: /homedetails/*view=owner";
    expect(robotsAllows(txt, "/homedetails/abc?view=owner", UA)).toBe(false);
    expect(robotsAllows(txt, "/homedetails/abc", UA)).toBe(true);
  });

  it("uses a group named for Corral over the * group", () => {
    const txt = "User-agent: *\nAllow: /\n\nUser-agent: CorralLinkPreview\nDisallow: /";
    expect(robotsAllows(txt, "/listing/1", UA)).toBe(false);
  });

  it("shares rules across stacked user-agent lines", () => {
    const txt = "User-agent: SomeBot\nUser-agent: *\nDisallow: /";
    expect(robotsAllows(txt, "/anything", UA)).toBe(false);
  });

  it("picks Corral's group by its exact name, not one that's part of it", () => {
    const txt = "User-agent: Preview\nAllow: /\n\nUser-agent: corrallinkpreview\nDisallow: /";
    expect(robotsAllows(txt, "/listing/1", UA)).toBe(false);
    expect(robotsAllows("User-agent: Preview\nDisallow: /", "/listing/1", UA)).toBe(true);
  });

  it("treats percent-encoded letters as the letters, but not an encoded slash", () => {
    const txt = "User-agent: *\nDisallow: /private\nDisallow: /a/b";
    expect(robotsAllows(txt, "/%70rivate", UA)).toBe(false);
    expect(robotsAllows(txt, "/a%2Fb", UA)).toBe(true);
  });

  it("anchors a trailing $ and keeps many wildcards fast", () => {
    expect(robotsAllows("User-agent: *\nDisallow: /*.pdf$", "/files/lease.pdf", UA)).toBe(false);
    expect(robotsAllows("User-agent: *\nDisallow: /*.pdf$", "/files/lease.pdf?dl=1", UA)).toBe(true);
    const rule = `/${"*a".repeat(32)}b`;
    const started = Date.now();
    expect(robotsAllows(`User-agent: *\nDisallow: ${rule}`, `/${"a".repeat(5000)}`, UA)).toBe(true);
    expect(Date.now() - started).toBeLessThan(200);
  });

  it("matches non-ASCII rules against encoded paths, and ranks rules by their normalized length", () => {
    expect(robotsAllows("User-agent: *\nDisallow: /café", "/caf%C3%A9", UA)).toBe(false);
    expect(robotsAllows("User-agent: *\nDisallow: /caf%c3%a9", "/café", UA)).toBe(false);
    expect(robotsAllows("User-agent: *\nAllow: /%61\nDisallow: /ab", "/ab", UA)).toBe(false);
  });
});
