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
});
