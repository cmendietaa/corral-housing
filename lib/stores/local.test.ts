import { describe, expect, it } from "vitest";
import { emptyListingInput } from "@/lib/listing";
import { createLocalStore, DEMO_STORAGE_KEY } from "./local";

function memoryStorage() {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k)
  };
}

const now = () => new Date("2026-11-09T12:00:00");

describe("local demo store", () => {
  it("seeds the fictional board on first load and persists it", async () => {
    const storage = memoryStorage();
    const snap = await createLocalStore({ storage, now }).load();
    expect(snap.listings).toHaveLength(6);
    expect(snap.board.members.map((m) => m.name)).toEqual(["Maya", "Jordan", "Sam", "Priya"]);
    expect(storage.map.has(DEMO_STORAGE_KEY)).toBe(true);
  });

  it("includes the PRD example: Sabado Tarde, Contacted, parking question for Maya by Friday", async () => {
    const snap = await createLocalStore({ storage: memoryStorage(), now }).load();
    const sabado = snap.listings.find((l) => l.address?.includes("Sabado Tarde"));
    expect(sabado?.status).toBe("contacted");
    expect(sabado?.nextAction).toBe("Ask whether parking is included");
    expect(sabado?.nextActionAssignee).toBe("maya");
    expect(new Date(`${sabado?.nextActionDue}T12:00:00`).getDay()).toBe(5);
  });

  it("keeps added and edited places across a new store instance (a page reload)", async () => {
    const storage = memoryStorage();
    const first = createLocalStore({ storage, now });
    const added = await first.addListing({
      ...emptyListingInput(),
      title: "Camino Pescadero studio",
      url: "https://example.com/new"
    });
    await first.updateListing(added.id, { status: "contacted", starred: true });

    const reloaded = await createLocalStore({ storage, now }).load();
    const found = reloaded.listings.find((l) => l.id === added.id);
    expect(found?.status).toBe("contacted");
    expect(found?.starred).toBe(true);
    expect(found?.rentCents).toBeNull();
  });

  it("rejects javascript: links", async () => {
    const store = createLocalStore({ storage: memoryStorage(), now });
    await expect(
      store.addListing({ ...emptyListingInput(), title: "x", url: "javascript:alert(1)" })
    ).rejects.toThrow();
  });

  it("reset restores the fixture", async () => {
    const storage = memoryStorage();
    const store = createLocalStore({ storage, now });
    const { listings } = await store.load();
    await Promise.all(listings.map((l) => store.deleteListing(l.id)));
    expect((await store.load()).listings).toHaveLength(0);
    expect((await store.reset!()).listings).toHaveLength(6);
  });

  it("reseeds when stored data is corrupt", async () => {
    const storage = memoryStorage();
    storage.setItem(DEMO_STORAGE_KEY, "{not json");
    expect((await createLocalStore({ storage, now }).load()).listings).toHaveLength(6);
  });

  it("works without storage (blocked site data)", async () => {
    const store = createLocalStore({ storage: null, now });
    await store.addListing({ ...emptyListingInput(), title: "x", url: "https://example.com" });
    expect((await store.load()).listings).toHaveLength(7);
  });
});
