import type { Board, Listing, ListingInput, ListingPatch } from "@/lib/listing";

export type BoardSnapshot = { board: Board; listings: Listing[] };

/** A roommate's tour photo. `url` is ready for an <img> (signed URL or object URL). */
export type Photo = {
  id: string;
  listingId: string;
  url: string;
  uploadedBy: string | null;
  createdAt: string;
};

export const MAX_PHOTOS_PER_PLACE = 8;

/**
 * Everything the board UI needs from storage. The demo uses localStorage and
 * private boards use Supabase; the UI never knows which one it has.
 */
export interface BoardStore {
  /** "demo" boards show the fictional-data banner and a Reset button. */
  readonly kind: "demo" | "private";
  load(): Promise<BoardSnapshot>;
  addListing(input: ListingInput): Promise<Listing>;
  updateListing(id: string, patch: ListingPatch): Promise<Listing>;
  deleteListing(id: string): Promise<void>;
  reset?(): Promise<BoardSnapshot>;
  /** Tour photos for every place on the board, oldest first. */
  loadPhotos?(): Promise<Photo[]>;
  /** Saves an already-shrunk JPEG. */
  addPhoto?(listingId: string, jpeg: Blob): Promise<Photo>;
  deletePhoto?(photo: Photo): Promise<void>;
  /** Live updates: calls onChange when someone else changes the board. Returns an unsubscribe. */
  subscribe?(onChange: () => void): () => void;
}
