import { describe, expect, it } from "vitest";
import { emptyListingInput } from "@/lib/listing";
import { asLink, fillEmpty, parsedToDraft, toDraft, validateDraft } from "./place-draft";

describe("asLink", () => {
  it("spots a single pasted link", () => {
    expect(asLink("  https://ivrentals.example/listings/1 ")).toBe("https://ivrentals.example/listings/1");
    expect(asLink("www.ivrentals.example/x")).toBe("https://www.ivrentals.example/x");
  });
  it("treats anything else as listing text", () => {
    expect(asLink("4BR duplex https://example.com/x")).toBeNull();
    expect(asLink("$5,400/mo near Pardall")).toBeNull();
    expect(asLink("")).toBeNull();
  });
});

describe("fillEmpty", () => {
  it("fills blanks and never overwrites what was typed", () => {
    const draft = { ...toDraft(emptyListingInput()), title: "Our name for it" };
    const incoming = parsedToDraft({
      title: "Listing title",
      address: "6550 Pardall Rd",
      url: null,
      rentCents: 480000,
      beds: 3,
      baths: null,
      leaseStart: null,
      leaseEnd: null,
      parking: null,
      laundry: "on_site",
      priceBasis: null
    });
    const { next, changed } = fillEmpty(draft, incoming);
    expect(next.title).toBe("Our name for it");
    expect(next.rent).toBe("4800");
    expect([...changed].sort()).toEqual(["address", "beds", "laundry", "rent"]);
  });
});

describe("validateDraft", () => {
  it("turns a draft into a listing", () => {
    const { input, errors } = validateDraft({ ...toDraft(emptyListingInput()), title: "Cottage", rent: "$3,200", beds: "2", baths: "1.5" }, emptyListingInput());
    expect(errors).toEqual({});
    expect(input).toMatchObject({ title: "Cottage", rentCents: 320000, beds: 2, baths: 1.5 });
  });
  it("says what's wrong, field by field", () => {
    const { input, errors } = validateDraft(
      { ...toDraft(emptyListingInput()), title: "", rent: "lots", leaseStart: "2027-09-01", leaseEnd: "2027-08-01" },
      emptyListingInput()
    );
    expect(input).toBeNull();
    expect(Object.keys(errors).sort()).toEqual(["leaseEnd", "rent", "title"]);
  });
});
