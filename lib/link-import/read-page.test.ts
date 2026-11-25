import { describe, expect, it } from "vitest";
import { focusListingText, readPage, readSentPage } from "./read-page";

const LISTING = `<!doctype html><html><head>
<title>6550 Pardall Rd #2 | IV Rentals</title>
<meta property="og:title" content="Upstairs 3BR on Pardall &amp; Embarcadero">
<meta name="description" content="3 bed / 2 bath, $4,800/mo, available Sept 1. Laundry on site.">
<script type="application/ld+json">{"@context":"https://schema.org","@graph":[
  {"@type":"Organization","name":"IV Rentals"},
  {"@type":"Apartment","name":"6550 Pardall Rd #2","numberOfRooms":3,"numberOfBathroomsTotal":2,
   "address":{"@type":"PostalAddress","streetAddress":"6550 Pardall Rd #2","addressLocality":"Isla Vista"},
   "offers":{"@type":"Offer","price":"4800","priceCurrency":"USD"}}]}</script>
<script>window.tracking = "captcha-free";</script>
</head><body><nav>Home Listings Contact</nav><main><h1>6550 Pardall Rd #2</h1><p>Bright upstairs unit.</p></main></body></html>`;

describe("readPage", () => {
  it("reads facts the page publishes about itself", () => {
    const r = readPage(LISTING);
    expect(r.facts).toEqual({ title: "6550 Pardall Rd #2", address: "6550 Pardall Rd #2, Isla Vista", rentCents: 480000, beds: 3, baths: 2 });
    expect(r.challenge).toBe(false);
  });

  it("hands the reader the description and visible text, without scripts or navigation", () => {
    const r = readPage(LISTING);
    expect(r.text).toContain("$4,800/mo, available Sept 1");
    expect(r.text).toContain("Bright upstairs unit.");
    expect(r.text).not.toContain("window.tracking");
    expect(r.text).not.toContain("Home Listings Contact");
  });

  it("falls back to the share preview when there's no structured data", () => {
    const r = readPage(`<html><head><meta property="og:title" content="Garden cottage on Picasso"></head><body>2 bd 1 ba</body></html>`);
    expect(r.facts.title).toBe("Garden cottage on Picasso");
    expect(r.facts.rentCents).toBeNull();
  });

  it("ignores sale prices and broken structured data", () => {
    const r = readPage(`<script type="application/ld+json">{"@type":"House","offers":{"price":1250000}}</script><script type="application/ld+json">{broken</script><body>x</body>`);
    expect(r.facts.rentCents).toBeNull();
  });

  it("recognizes a bot-check page", () => {
    expect(readPage(`<html><body><h1>Press &amp; Hold to confirm you are a human</h1><div id="px-captcha"></div></body></html>`).challenge).toBe(true);
  });
});

describe("pages sent from the browser", () => {
  it("keeps the listing's fact lines when the page is long", () => {
    const menu = Array.from({ length: 400 }, (_, i) => `Menu item number ${i}`).join("\n");
    const text = `${menu}\n$2,750 / MONTH\nStudio\n1 bath\n6531 Del Playa Drive, #06\n${menu}`;
    const out = focusListingText("Studio on Del Playa", text, 1200);
    expect(out.length).toBeLessThanOrEqual(1200);
    expect(out).toContain("$2,750 / MONTH");
    expect(out).toContain("1 bath");
    expect(out.startsWith("Studio on Del Playa")).toBe(true);
  });

  it("reads structured data a sent page carries", () => {
    const r = readSentPage({
      url: "https://ivrentals.example/1",
      title: "Listing",
      text: "Nice place",
      ld: ['{"@type":"Apartment","name":"6550 Pardall #2","numberOfRooms":3,"offers":{"price":"4800"}}', "{broken"]
    });
    expect(r.facts).toMatchObject({ title: "6550 Pardall #2", beds: 3, rentCents: 480000 });
  });
});

describe("listing photos", () => {
  it("finds the share image, structured-data images and page photos, skipping logos", () => {
    const html = `<head><meta property="og:image" content="/img/front.jpg"><script type="application/ld+json">{"@type":"Apartment","image":["https://cdn.example/a.jpg",{"url":"https://cdn.example/b.jpg"}]}</script></head>
      <body><img src="/assets/logo.png"><img data-src="https://cdn.example/kitchen.jpeg?w=800"><img src="https://cdn.example/a.jpg"><img src="/icons/bed.svg"></body>`;
    expect(readPage(html, "https://ivrentals.example/listing/1").images).toEqual([
      "https://ivrentals.example/img/front.jpg",
      "https://cdn.example/a.jpg",
      "https://cdn.example/b.jpg",
      "https://cdn.example/kitchen.jpeg?w=800"
    ]);
  });
});

