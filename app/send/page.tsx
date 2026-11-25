import type { Metadata } from "next";
import { getSessionUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import { SendToCorral } from "./send-to-corral";

export const metadata: Metadata = { title: "Send to Corral" };
export const dynamic = "force-dynamic";

type BoardRow = { id: string; name: string; lease_year: string; board_members: { display_name: string }[] };

/**
 * Where "Send to Corral" lands: the listing someone was looking at arrives
 * from their own browser, they pick a board, and it opens straight into
 * Round it up there. RLS decides which boards are listed.
 */
export default async function SendPage() {
  const user = await getSessionUser();
  let boards: { id: string; name: string; leaseYear: string; members: string[] }[] = [];
  if (user) {
    const supabase = await createClient();
    const { data } = await supabase!
      .from("boards")
      .select("id, name, lease_year, board_members(display_name)")
      .order("created_at", { ascending: false });
    boards = ((data ?? []) as unknown as BoardRow[]).map((b) => ({
      id: b.id,
      name: b.name,
      leaseYear: b.lease_year,
      members: b.board_members.map((m) => m.display_name)
    }));
  }
  return <SendToCorral signedIn={Boolean(user)} boards={boards} />;
}
