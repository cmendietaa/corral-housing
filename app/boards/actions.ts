"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { parseDollars } from "@/lib/format";
import { getSessionUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

const newBoardSchema = z.object({
  name: z.string().trim().min(1, "Give the board a name").max(80, "Keep the name under 80 characters"),
  leaseYear: z.string().trim().max(20, "Keep the lease year short, like 2027–28"),
  budget: z.string().trim().max(12)
});

export type CreateBoardState = { error: string | null };

export async function createBoard(_prev: CreateBoardState, formData: FormData): Promise<CreateBoardState> {
  const user = await getSessionUser();
  if (!user) return { error: "Your session ended. Sign in again to create a board." };

  const parsed = newBoardSchema.safeParse({
    name: formData.get("name") ?? "",
    leaseYear: formData.get("leaseYear") ?? "",
    budget: formData.get("budget") ?? ""
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form and try again." };

  const budgetCents = parseDollars(parsed.data.budget);
  if (Number.isNaN(budgetCents)) return { error: "Enter the budget per person as a number, like 1400." };

  const supabase = await createClient();
  if (!supabase) return { error: "Private boards aren't set up on this deployment." };
  const { data, error } = await supabase.rpc("create_board", {
    p_name: parsed.data.name,
    p_display_name: user.name,
    p_lease_year: parsed.data.leaseYear,
    p_budget_per_person_cents: budgetCents
  });
  if (error || !data) return { error: "Couldn't create the board. Try again." };

  redirect(`/boards/${data}`);
}

export type RedeemState = { error: string | null };

const INVITE_ERRORS: Record<string, string> = {
  invite_invalid: "This invite link isn't valid. Ask whoever sent it for a new one.",
  invite_revoked: "This invite was turned off. Ask whoever sent it for a new link.",
  invite_expired: "This invite expired. Ask whoever sent it for a new link."
};

export async function redeemInvite(_prev: RedeemState, formData: FormData): Promise<RedeemState> {
  const user = await getSessionUser();
  if (!user) return { error: "Your session ended. Sign in again to join." };
  const token = z.string().uuid().safeParse(formData.get("token"));
  if (!token.success) return { error: INVITE_ERRORS.invite_invalid };

  const supabase = await createClient();
  if (!supabase) return { error: "Private boards aren't set up on this deployment." };
  const { data, error } = await supabase.rpc("redeem_invite", { p_token: token.data, p_display_name: user.name });
  if (error || !data) return { error: (error && INVITE_ERRORS[error.message]) ?? "Couldn't join the board. Try again." };

  redirect(`/boards/${data}`);
}
