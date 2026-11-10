import type { Metadata } from "next";
import Link from "next/link";
import { z } from "zod";
import { SignInButton } from "@/components/auth/sign-in-button";
import { PageShell } from "@/components/brand/page-shell";
import { getSessionUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import { PrivateBoard } from "./private-board";

export const metadata: Metadata = { title: "Board · Corral" };
export const dynamic = "force-dynamic";

export default async function BoardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSessionUser();

  if (!user) {
    return (
      <PageShell>
        <div className="mx-auto max-w-lg rounded-[30px] bg-shell-deep p-8 text-center">
          <h1 className="font-display text-[26px] text-tar">Sign in to open this board</h1>
          <p className="mt-2 text-stone-700">Boards are private to the roommates on them.</p>
          <div className="mt-6 flex justify-center">
            <SignInButton size="lg" next={`/boards/${encodeURIComponent(id)}`} />
          </div>
        </div>
      </PageShell>
    );
  }

  // RLS decides: a non-member gets no row, the same as a board that doesn't exist,
  // so the page never reveals whether a board id is real.
  const valid = z.string().uuid().safeParse(id).success;
  const supabase = await createClient();
  const { data: board } = valid
    ? await supabase!.from("boards").select("id").eq("id", id).maybeSingle()
    : { data: null };

  if (!board) {
    return (
      <PageShell>
        <div className="mx-auto max-w-lg rounded-[30px] bg-sea-100 p-8 text-center">
          <h1 className="font-display text-[26px] text-tar">This board isn&apos;t yours to see</h1>
          <p className="mt-2 text-stone-800">
            It doesn&apos;t exist, or you&apos;re not a member. Ask a roommate on the board for an invite link.
          </p>
          <Link href="/boards" className="mt-5 inline-block font-semibold text-sea-700 underline underline-offset-4">
            Back to your boards
          </Link>
        </div>
      </PageShell>
    );
  }

  return <PrivateBoard boardId={board.id} photos={Boolean(process.env.GOOGLE_MAPS_API_KEY)} />;
}
