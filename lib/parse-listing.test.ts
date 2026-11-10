import { describe, expect, it } from "vitest";
import { countFilled, parseListingText } from "./parse-listing";

const now = new Date("2026-11-09T12:00:00");

const CRAIGSLIST = `4BR/2BA Upstairs Duplex near Pardall - $5,400/mo
https://santabarbara.craigslist.org/apa/d/isla-vista-4br-duplex/7712345678.html

6512 Sabado Tarde Rd, Isla Vista
Rent: $5,400 per month. Security deposit $6,000.
Available Sept 1 - Aug 31 (12-month lease).
Washer/dryer in unit. Driveway parking for 2 cars.
No pets. Contact the property manager to schedule a tour.`;

const EMAIL = `Hi! Following up on the place on Del Playa.
The unit at 6680 Del Playa is a 5 bed / 2 bath, $7,200 a month, utilities not included ($150/person).
Lease starts 9/1/27, 12 month lease. Street parking only. Shared laundry room downstairs.`;

describe("parseListingText", () => {
  it("reads a Craigslist-style listing", () => {
    const p = parseListingText(CRAIGSLIST, now);
    expect(p).toMatchObject({
      title: "4BR/2BA Upstairs Duplex near Pardall",
      address: "6512 Sabado Tarde Rd, Isla Vista",
      url: "https://santabarbara.craigslist.org/apa/d/isla-vista-4br-duplex/7712345678.html",
      rentCents: 540000,
      beds: 4,
      baths: 2,
      leaseStart: "2027-09-01",
      leaseEnd: "2028-08-31",
      parking: "driveway",
      laundry: "in_unit"
    });
  });

  it("reads a messier email and ignores per-person fees and deposits", () => {
    const p = parseListingText(EMAIL, now);
    expect(p.address).toBe("6680 Del Playa");
    expect(p.rentCents).toBe(720000);
    expect(p.beds).toBe(5);
    expect(p.baths).toBe(2);
    expect(p.leaseStart).toBe("2027-09-01");
    expect(p.leaseEnd).toBe("2028-08-31");
    expect(p.parking).toBe("street");
    expect(p.laundry).toBe("on_site");
  });

  it("leaves unknowns as null instead of guessing", () => {
    const p = parseListingText("Cute place, call for price. Great vibes.", now);
    expect(p.rentCents).toBeNull();
    expect(p.beds).toBeNull();
    expect(p.leaseStart).toBeNull();
    expect(countFilled(p)).toBe(1); // just the title
  });

  it("doesn't mistake a longer street name for a suffix", () => {
    expect(parseListingText("6680 Del Playa Dr, Isla Vista", now).address).toBe("6680 Del Playa Dr, Isla Vista");
  });

  it("makes a short, tidy name from a one-line paste", () => {
    expect(parseListingText("Studio on Trigo, $1,850/mo, available June 15. Coin laundry.", now).title).toBe(
      "Studio on Trigo, available June 15"
    );
  });

  it("never returns a javascript: link", () => {
    expect(parseListingText("Link: javascript:alert(1)", now).url).toBeNull();
  });

  it("understands studios and half baths", () => {
    const p = parseListingText("Studio, 1.5 bath, $1,850/mo", now);
    expect(p.beds).toBe(0);
    expect(p.baths).toBe(1.5);
    expect(p.rentCents).toBe(185000);
  });

  it("rolls a month/day without a year to the next time it comes around", () => {
    expect(parseListingText("Available June 15", now).leaseStart).toBe("2027-06-15");
    expect(parseListingText("Available December 1", now).leaseStart).toBe("2026-12-01");
  });
});
