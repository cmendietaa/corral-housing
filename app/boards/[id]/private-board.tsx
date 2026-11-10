"use client";

import { useCallback, useState } from "react";
import { Board } from "@/components/board/board";
import { createClient } from "@/lib/supabase/client";
import { createInvite, createSupabaseStore } from "@/lib/stores/supabase";

export function PrivateBoard({ boardId, photos }: { boardId: string; photos: boolean }) {
  const [supabase] = useState(() => createClient()!);
  const [store] = useState(() => createSupabaseStore(supabase, boardId));
  const makeInviteLink = useCallback(() => createInvite(supabase, boardId), [supabase, boardId]);
  return <Board store={store} photos={photos} makeInviteLink={makeInviteLink} />;
}
