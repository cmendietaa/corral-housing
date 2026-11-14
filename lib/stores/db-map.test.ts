import { describe, expect, it } from "vitest";
import { patchToRow, rowToListing, type ListingRow } from "./db-map";

const row: ListingRow = {
  id: "11111111-1111-4111-8111-111111111111",
  board_id: "b",
  title: "Blue duplex",
  address: "6512 Sabado Tarde Rd, Isla Vista",
  url: "https://example.com/a",
  rent_cents: 540000,
  beds: "4.0",
  baths: 2,
  lease_start: "2027-09-01",
  lease_end: null,
  parking: "driveway",
  laundry: null,
  lat: 34.41,
  lng: -119.85,
  status: "contacted",
  starred: true,
  notes: null,
  next_action: "Ask about parking",
  next_action_assignee: "u1",
  next_action_due: "2027-01-01",
  updated_at: "2026-11-09T00:00:00Z"
};

describe("rowToListing", () => {
  it("maps snake_case columns and turns numeric strings into numbers", () => {
    const l = rowToListing(row);
    expect(l).toMatchObject({ rentCents: 540000, beds: 4, baths: 2, leaseStart: "2027-09-01", nextActionAssignee: "u1" });
  });
  it("rejects rows that break the app's rules", () => {
    expect(() => rowToListing({ ...row, url: "javascript:alert(1)" })).toThrow();
    expect(rowToListing({ ...row, url: null }).url).toBeNull();
    expect(() => rowToListing({ ...row, status: "lost" })).toThrow();
  });
});

describe("patchToRow", () => {
  it("maps only writable fields", () => {
    expect(patchToRow({ status: "applied", starred: false, nextActionDue: null })).toEqual({
      status: "applied",
      starred: false,
      next_action_due: null
    });
    // Unknown keys (e.g. a smuggled board_id) are dropped.
    expect(patchToRow({ board_id: "other" } as never)).toEqual({});
  });
});
