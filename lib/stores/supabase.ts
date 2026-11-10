import type { SupabaseClient } from "@supabase/supabase-js";
import { listingInputSchema, type Board, type ListingInput, type ListingPatch } from "@/lib/listing";
import { patchToRow, rowToListing, type ListingRow } from "@/lib/stores/db-map";
import type { BoardStore } from "@/lib/stores/types";

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

    async deleteListing(id: string) {
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
