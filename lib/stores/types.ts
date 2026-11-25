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

export type MemberRole = "owner" | "member";

/** A roommate as the settings screen sees them. */
export type MemberInfo = { id: string; name: string; role: MemberRole; isMe: boolean };

/** An invite link that still works. `createdBy` is a member id, or null if unknown. */
export type InviteInfo = { token: string; createdBy: string | null; expiresAt: string };

export type BoardDetails = { name: string; leaseYear: string; budgetPerPersonCents: number | null };

export type SettingsSnapshot = {
  members: MemberInfo[];
  invites: InviteInfo[];
  /** Whether this viewer can change the board's name, lease year and budget. */
  canEditBoard: boolean;
};

/**
 * Board settings. Optional actions the store can't do are left out, and the
 * screen hides them. None of this is a security boundary: private boards
 * enforce every rule in Postgres.
 */
export interface BoardSettings {
  load(): Promise<SettingsSnapshot>;
  updateBoard(details: BoardDetails): Promise<void>;
  renameMe?(name: string): Promise<void>;
  removeMember?(userId: string): Promise<void>;
  makeOwner?(userId: string): Promise<void>;
  leave?(): Promise<void>;
  revokeInvite?(token: string): Promise<void>;
  deleteBoard?(): Promise<void>;
}

/** The message a store throws when the viewer isn't (or is no longer) on the board. */
export const NOT_ON_BOARD = "This board doesn't exist, or you're not a member of it.";

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
  /** Name, budget, roommates and invite links. */
  settings?: BoardSettings;
}
