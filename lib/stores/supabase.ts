import type { SupabaseClient } from "@supabase/supabase-js";
import { listingInputSchema, type Board, type ListingInput, type ListingPatch } from "@/lib/listing";
import { patchToRow, rowToListing, type ListingRow } from "@/lib/stores/db-map";
import { MAX_PHOTOS_PER_PLACE, type BoardStore, type Photo } from "@/lib/stores/types";

const BUCKET = "tour-photos";
// Signed photo links last an hour; the board refreshes them before then.
const SIGNED_URL_SECONDS = 60 * 60;

type PhotoRow = { id: string; listing_id: string; path: string; uploaded_by: string | null; created_at: string };

/**
 * Private boards, stored in Supabase. Access is enforced by Postgres RLS: this
 * client can only see and change boards the signed-in user is a member of.
 * Nothing here is a security boundary; it just turns errors into plain words.
 */
export function createSupabaseStore(supabase: SupabaseClient, boardId: string): BoardStore {
  function fail(message: string): never {
    throw new Error(message);
  }

  return {
    kind: "private",

    async load() {
      const [board, members, listings] = await Promise.all([
        supabase.from("boards").select("id, name, lease_year, budget_per_person_cents").eq("id", boardId).maybeSingle(),
        supabase.from("board_members").select("user_id, display_name, joined_at").eq("board_id", boardId).order("joined_at"),
        supabase.from("listings").select("*").eq("board_id", boardId).order("created_at", { ascending: false })
      ]);
      if (board.error || members.error || listings.error) fail("Couldn't load this board. Check your connection and try again.");
      if (!board.data) fail("This board doesn't exist, or you're not a member of it.");

      const b: Board = {
        id: board.data.id,
        name: board.data.name,
        leaseYear: board.data.lease_year,
        budgetPerPersonCents: board.data.budget_per_person_cents,
        members: (members.data ?? []).map((m) => ({ id: m.user_id, name: m.display_name }))
      };
      return { board: b, listings: (listings.data as ListingRow[]).map(rowToListing) };
    },

    async addListing(input: ListingInput) {
      const data = listingInputSchema.parse(input);
      const { data: row, error } = await supabase
        .from("listings")
        .insert({ board_id: boardId, ...patchToRow(data) })
        .select("*")
        .single();
      if (error || !row) fail(error?.message.includes("not on this board") ? error.message : "Couldn't add this place. Try again.");
      return rowToListing(row as ListingRow);
    },

    async updateListing(id: string, patch: ListingPatch) {
      const { data: row, error } = await supabase
        .from("listings")
        .update(patchToRow(patch))
        .eq("id", id)
        .eq("board_id", boardId)
        .select("*")
        .maybeSingle();
      if (error) fail(error.message.includes("not on this board") ? error.message : "Couldn't save that change. Try again.");
      // RLS turns a forbidden or missing row into "0 rows", not an error.
      if (!row) fail("That place is no longer on this board.");
      return rowToListing(row as ListingRow);
    },

    subscribe(onChange) {
      // Postgres changes respect RLS, so only members of this board get events.
      let timer: ReturnType<typeof setTimeout> | undefined;
      const ping = () => {
        clearTimeout(timer);
        timer = setTimeout(onChange, 300);
      };
      const channel = supabase
        .channel(`board:${boardId}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "listings", filter: `board_id=eq.${boardId}` }, ping)
        .on("postgres_changes", { event: "*", schema: "public", table: "board_members", filter: `board_id=eq.${boardId}` }, ping)
        .on("postgres_changes", { event: "*", schema: "public", table: "listing_photos", filter: `board_id=eq.${boardId}` }, ping)
        .subscribe();
      return () => {
        clearTimeout(timer);
        void supabase.removeChannel(channel);
      };
    },

    async loadPhotos() {
      const { data, error } = await supabase
        .from("listing_photos")
        .select("id, listing_id, path, uploaded_by, created_at")
        .eq("board_id", boardId)
        .order("created_at");
      if (error) fail("Couldn't load tour photos.");
      const rows = (data ?? []) as PhotoRow[];
      if (rows.length === 0) return [];
      const { data: signed } = await supabase.storage.from(BUCKET).createSignedUrls(
        rows.map((r) => r.path),
        SIGNED_URL_SECONDS
      );
      const urls = new Map((signed ?? []).filter((s) => s.signedUrl).map((s) => [s.path, s.signedUrl]));
      return rows.flatMap((r): Photo[] => {
        const url = urls.get(r.path);
        // A row whose upload never finished has no file; skip it.
        return url ? [{ id: r.id, listingId: r.listing_id, url, uploadedBy: r.uploaded_by, createdAt: r.created_at }] : [];
      });
    },

    async addPhoto(listingId: string, jpeg: Blob) {
      // Index first (RLS checks membership and the 8-photo cap), then upload to
      // the path the database derived. Storage only accepts indexed paths.
      const { data: row, error } = await supabase
        .from("listing_photos")
        .insert({ id: crypto.randomUUID(), board_id: boardId, listing_id: listingId })
        .select("id, listing_id, path, uploaded_by, created_at")
        .single();
      if (error || !row) {
        fail(error?.message.includes("up to") ? `A place can have up to ${MAX_PHOTOS_PER_PLACE} photos.` : "Couldn't add that photo. Try again.");
      }
      const r = row as PhotoRow;
      const up = await supabase.storage.from(BUCKET).upload(r.path, jpeg, { contentType: "image/jpeg", upsert: false });
      if (up.error) {
        await supabase.from("listing_photos").delete().eq("id", r.id);
        fail("Couldn't upload that photo. Check your connection and try again.");
      }
      const { data: signed } = await supabase.storage.from(BUCKET).createSignedUrl(r.path, SIGNED_URL_SECONDS);
      return {
        id: r.id,
        listingId: r.listing_id,
        url: signed?.signedUrl ?? URL.createObjectURL(jpeg),
        uploadedBy: r.uploaded_by,
        createdAt: r.created_at
      };
    },

    async deletePhoto(photo: Photo) {
      const { data, error } = await supabase.from("listing_photos").delete().eq("id", photo.id).select("path").maybeSingle();
      if (error) fail("Couldn't remove that photo. Try again.");
      if (data?.path) await supabase.storage.from(BUCKET).remove([data.path]);
    },

    async deleteListing(id: string) {
      // Remove the place's photo files first; the rows go with the listing.
      const { data: photoRows } = await supabase.from("listing_photos").select("path").eq("listing_id", id);
      const paths = (photoRows ?? []).map((p: { path: string }) => p.path);
      if (paths.length) await supabase.storage.from(BUCKET).remove(paths);
      const { error } = await supabase.from("listings").delete().eq("id", id).eq("board_id", boardId);
      if (error) fail("Couldn't remove this place. Try again.");
    }
  };
}

/** Make a new invite link for a board. Any member can. */
export async function createInvite(supabase: SupabaseClient, boardId: string): Promise<string> {
  const { data, error } = await supabase.from("invites").insert({ board_id: boardId }).select("token").single();
  if (error || !data) throw new Error("Couldn't make an invite link. Try again.");
  return `${window.location.origin}/invite/${data.token}`;
}
