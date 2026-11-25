import { describe, expect, it } from "vitest";
import { resolveCover } from "./cover";
import type { Photo } from "./stores/types";

const photo = (id: string): Photo => ({ id, listingId: "l1", url: `blob:${id}`, uploadedBy: null, createdAt: "2026-11-19T00:00:00Z" });
const a = photo("a");
const b = photo("b");

describe("resolveCover", () => {
  it("shows Street View when there are no photos", () => {
    expect(resolveCover({ cover: null, streetView: true }, [])).toEqual({ kind: "street" });
  });

  it("leads with the first added photo by default", () => {
    expect(resolveCover({ cover: null, streetView: true }, [a, b])).toEqual({ kind: "photo", photo: a });
  });

  it("keeps Street View as the cover when the group picked it", () => {
    expect(resolveCover({ cover: "street", streetView: true }, [a, b])).toEqual({ kind: "street" });
  });

  it("uses the picked photo", () => {
    expect(resolveCover({ cover: "b", streetView: true }, [a, b])).toEqual({ kind: "photo", photo: b });
  });

  it("falls back when the picked photo was removed", () => {
    expect(resolveCover({ cover: "gone", streetView: true }, [a])).toEqual({ kind: "photo", photo: a });
    expect(resolveCover({ cover: "gone", streetView: true }, [])).toEqual({ kind: "street" });
  });

  it("never shows hidden Street View, even if it was the cover", () => {
    expect(resolveCover({ cover: "street", streetView: false }, [a])).toEqual({ kind: "photo", photo: a });
    expect(resolveCover({ cover: "street", streetView: false }, [])).toEqual({ kind: "none" });
  });

  it("treats an unknown place like a default one", () => {
    expect(resolveCover(undefined, [])).toEqual({ kind: "street" });
  });
});
