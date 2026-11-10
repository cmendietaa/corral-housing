import { z } from "zod";
import { createDemoSnapshot } from "@/lib/demo-fixture";
import {
  listingInputSchema,
  listingSchema,
  type Listing,
  type ListingInput,
  type ListingPatch
} from "@/lib/listing";
import type { BoardSnapshot, BoardStore, Photo } from "@/lib/stores/types";
import { createDemoPhotos, DEMO_PHOTO_CHANNEL } from "@/lib/stores/demo-photos";

/**
 * Demo storage: one fictional board kept in this browser's localStorage.
 * It never imports or calls Supabase. If storage is unavailable (private
 * window, blocked site data), the demo still works in memory for the session.
 */

export const DEMO_STORAGE_KEY = "corral:demo:v5";

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
  // Opened on first use, so unit tests and server renders never touch IndexedDB.
  let demoPhotos: ReturnType<typeof createDemoPhotos> | null = null;
  const photos = () => (demoPhotos ??= createDemoPhotos(newId, now));

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

    // Live updates between tabs: the browser fires "storage" in every other
    // tab of this origin when the demo board is saved. Drop the cached copy
    // so the next load reads what the other tab wrote.
    subscribe(onChange) {
      if (typeof window === "undefined") return () => {};
      const handler = (e: StorageEvent) => {
        if (e.key !== DEMO_STORAGE_KEY) return;
        memory = null;
        onChange();
      };
      window.addEventListener("storage", handler);
      // Photos live in IndexedDB, which has no change event; tabs ping each other.
      const channel = typeof BroadcastChannel === "undefined" ? null : new BroadcastChannel(DEMO_PHOTO_CHANNEL);
      if (channel) channel.onmessage = () => onChange();
      return () => {
        window.removeEventListener("storage", handler);
        channel?.close();
      };
    },

    async loadPhotos() {
      return photos().load();
    },

    async addPhoto(listingId: string, jpeg: Blob) {
      if (!read().listings.some((l) => l.id === listingId)) throw new Error("That place is no longer on the board.");
      return photos().add(listingId, jpeg);
    },

    async deletePhoto(photo: Photo) {
      await photos().delete(photo.id);
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
      await photos().deleteForListing(id);
    },

    async reset() {
      const fresh = createDemoSnapshot(now());
      write(fresh);
      await photos().clear();
      return clone(fresh);
    }
  };
}
