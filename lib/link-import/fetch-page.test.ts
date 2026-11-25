import { describe, expect, it } from "vitest";
import { checkUrl, FetchRefused, isPrivateAddress } from "./fetch-page";
import { skippedSite } from "./sites";

function refusal(raw: string): FetchRefused["reason"] | null {
  try {
    checkUrl(raw);
    return null;
  } catch (e) {
    return e instanceof FetchRefused ? e.reason : null;
  }
}

describe("link checks", () => {
  it("accepts ordinary public listing links", () => {
    expect(checkUrl("https://www.ivpropertymanager.example/rentals/6512#photos").toString()).toBe("https://www.ivpropertymanager.example/rentals/6512");
    expect(refusal("http://example.com/listing?id=4")).toBeNull();
  });

  it("refuses links that aren't public web pages", () => {
    expect(refusal("ftp://example.com/x")).toBe("invalid");
    expect(refusal("javascript:alert(1)")).toBe("invalid");
    expect(refusal("https://user:pw@example.com/")).toBe("invalid");
    expect(refusal("https://example.com:8080/")).toBe("invalid");
    expect(refusal("http://localhost/")).toBe("private");
    expect(refusal("http://127.0.0.1/")).toBe("private");
    expect(refusal("http://169.254.169.254/latest/meta-data")).toBe("private");
    expect(refusal("http://[::1]/")).toBe("private");
    expect(refusal("http://intranet/")).toBe("private");
  });

  it("never fetches sites whose terms forbid it, including their subdomains", () => {
    expect(refusal("https://www.zillow.com/homedetails/1_zpid/")).toBe("skipped");
    expect(refusal("https://santabarbara.craigslist.org/apa/d/x/1.html")).toBe("skipped");
    expect(refusal("https://www.apartments.com/x-isla-vista-ca/abc/")).toBe("skipped");
    expect(skippedSite("hotpads.com")).toBe("Zillow");
    expect(skippedSite("notzillow.com")).toBeNull();
  });

  it("knows which addresses are private", () => {
    for (const ip of ["10.1.2.3", "172.16.0.1", "172.31.255.255", "192.168.1.1", "100.64.0.1", "0.0.0.0", "::1", "fd00::1", "fe80::1", "::ffff:127.0.0.1"]) {
      expect(isPrivateAddress(ip), ip).toBe(true);
    }
    for (const ip of ["93.184.216.34", "172.32.0.1", "8.8.8.8", "2606:4700::6810:84e5"]) {
      expect(isPrivateAddress(ip), ip).toBe(false);
    }
  });
});
