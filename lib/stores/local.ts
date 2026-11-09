import { z } from "zod";
import { createDemoSnapshot } from "@/lib/demo-fixture";
import {
  listingInputSchema,
  listingSchema,
  type Listing,
  type ListingInput,
  type ListingPatch
} from "@/lib/listing";
import type { BoardSnapshot, BoardStore } from "@/lib/stores/types";

/**
 * Demo storage: one fictional board kept in this browser's localStorage.
 * It never imports or calls Supabase. If storage is unavailable (private
 * window, blocked site data), the demo still works in memory for the session.
 */

export const DEMO_STORAGE_KEY = "corral:demo:v2";

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

const snapshotSchema = z.object({
  board: z.object({
    id: z.string(),
    name: z.string(),
    leaseYear: z.string(),
    members: z.array(z.object({ id: z.string(), name: z.string() })),
    budgetPerPersonCents: z.number().int().nullable()
  }),
  listings: z.array(listingSchema)
});

function browserStorage(): StorageLike | null {
  try {
    if (typeof window === "undefined") return null;
    const s = window.localStorage;
    const probe = "corral:probe";
    s.setItem(probe, "1");
    s.removeItem(probe);
    return s;
  } catch {
    return null;
  }
}

function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function createLocalStore(options: {
  storage?: StorageLike | null;
  now?: () => Date;
} = {}): BoardStore {
  const storage = options.storage === undefined ? browserStorage() : options.storage;
  const now = options.now ?? (() => new Date());
  let memory: BoardSnapshot | null = null;

  function read(): BoardSnapshot {
    if (memory) return memory;
    let parsed: BoardSnapshot | null = null;
    try {
      const raw = storage?.getItem(DEMO_STORAGE_KEY);
      if (raw) {
        const result = snapshotSchema.safeParse(JSON.parse(raw));
        if (result.success) parsed = result.data;
      }
    } catch {
      parsed = null;
    }
    memory = parsed ?? createDemoSnapshot(now());
    if (!parsed) write(memory);
    return memory;
  }

  function write(snapshot: BoardSnapshot) {
    memory = snapshot;
    try {
      storage?.setItem(DEMO_STORAGE_KEY, JSON.stringify(snapshot));
    } catch {
      // Storage full or blocked: keep the in-memory copy for this session.
    }
  }

  function clone(snapshot: BoardSnapshot): BoardSnapshot {
    return structuredClone(snapshot);
  }

  return {
    kind: "demo",

    async load() {
      return clone(read());
    },

    async addListing(input: ListingInput) {
      const data = listingInputSchema.parse(input);
      const listing: Listing = { ...data, id: newId(), updatedAt: now().toISOString() };
      const snap = read();
      write({ ...snap, listings: [listing, ...snap.listings] });
      return structuredClone(listing);
    },

    async updateListing(id: string, patch: ListingPatch) {
      const snap = read();
      const current = snap.listings.find((l) => l.id === id);
      if (!current) throw new Error("That place is no longer on the board.");
      const next = listingSchema.parse({ ...current, ...patch, id, updatedAt: now().toISOString() });
      write({ ...snap, listings: snap.listings.map((l) => (l.id === id ? next : l)) });
      return structuredClone(next);
    },

    async deleteListing(id: string) {
      const snap = read();
      write({ ...snap, listings: snap.listings.filter((l) => l.id !== id) });
    },

    async reset() {
      const fresh = createDemoSnapshot(now());
      write(fresh);
      return clone(fresh);
    }
  };
}
