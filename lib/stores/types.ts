import type { Board, Listing, ListingInput, ListingPatch } from "@/lib/listing";

export type BoardSnapshot = { board: Board; listings: Listing[] };

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
  /** Live updates: calls onChange when someone else changes the board. Returns an unsubscribe. */
  subscribe?(onChange: () => void): () => void;
}
