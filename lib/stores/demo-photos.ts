import { MAX_PHOTOS_PER_PLACE, type Photo } from "@/lib/stores/types";

/**
 * Demo tour photos: kept only in this browser (IndexedDB), never uploaded.
 * Falls back to memory where IndexedDB isn't available or refuses a photo.
 * Other tabs hear about changes over a BroadcastChannel.
 */

/**
 * A stored photo. New records keep the image as bytes (an ArrayBuffer):
 * Safari refuses to store Blobs in IndexedDB in some modes (private windows,
 * automated browsers), but takes plain bytes everywhere. Older records may
 * still hold a Blob.
 */
type Rec = { id: string; listingId: string; createdAt: string; bytes?: ArrayBuffer; type?: string; blob?: Blob };

const DB = "corral-demo";
const STORE = "photos";
export const DEMO_PHOTO_CHANNEL = "corral-demo-photos";

function openDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  return new Promise((resolve) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: "id" });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
  });
}

function tx<T>(db: IDBDatabase, mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const req = run(db.transaction(STORE, mode).objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export function createDemoPhotos(newId: () => string, now: () => Date) {
  const memory = new Map<string, Rec>();
  const urls = new Map<string, string>();
  const dbPromise = openDb();
  const channel = typeof BroadcastChannel === "undefined" ? null : new BroadcastChannel(DEMO_PHOTO_CHANNEL);

  async function all(): Promise<Rec[]> {
    const db = await dbPromise;
    let stored: Rec[] = [];
    if (db) {
      try {
        stored = await tx<Rec[]>(db, "readonly", (s) => s.getAll() as IDBRequest<Rec[]>);
      } catch {
        stored = [];
      }
    }
    // Photos that couldn't be stored live in memory for this visit.
    return [...stored, ...memory.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  function toPhoto(r: Rec): Photo {
    let url = urls.get(r.id);
    if (!url) {
      const blob = r.blob ?? new Blob([r.bytes ?? new ArrayBuffer(0)], { type: r.type || "image/jpeg" });
      url = URL.createObjectURL(blob);
      urls.set(r.id, url);
    }
    return { id: r.id, listingId: r.listingId, url, uploadedBy: null, createdAt: r.createdAt };
  }

  async function remove(ids: string[]) {
    const db = await dbPromise;
    for (const id of ids) {
      if (db) await tx(db, "readwrite", (s) => s.delete(id)).catch(() => {});
      memory.delete(id);
      const url = urls.get(id);
      if (url) URL.revokeObjectURL(url);
      urls.delete(id);
    }
    if (ids.length) channel?.postMessage("changed");
  }

  return {
    channel,
    async load(): Promise<Photo[]> {
      return (await all()).map(toPhoto);
    },
    async add(listingId: string, blob: Blob): Promise<Photo> {
      const existing = (await all()).filter((r) => r.listingId === listingId).length;
      if (existing >= MAX_PHOTOS_PER_PLACE) throw new Error(`A place can have up to ${MAX_PHOTOS_PER_PLACE} photos.`);
      const rec: Rec = { id: newId(), listingId, bytes: await blob.arrayBuffer(), type: blob.type || "image/jpeg", createdAt: now().toISOString() };
      const db = await dbPromise;
      if (!db) memory.set(rec.id, rec);
      else {
        try {
          await tx(db, "readwrite", (s) => s.put(rec));
        } catch (err) {
          if (err instanceof DOMException && err.name === "QuotaExceededError") throw new Error("This browser is out of room for demo photos.");
          // Storage refused it for another reason: keep it for this visit.
          memory.set(rec.id, rec);
        }
      }
      channel?.postMessage("changed");
      return toPhoto(rec);
    },
    async delete(id: string) {
      await remove([id]);
    },
    async deleteForListing(listingId: string) {
      await remove((await all()).filter((r) => r.listingId === listingId).map((r) => r.id));
    },
    async clear() {
      await remove((await all()).map((r) => r.id));
    }
  };
}
