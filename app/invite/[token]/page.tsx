import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { z } from "zod";
import { SignInButton } from "@/components/auth/sign-in-button";
import { PageShell } from "@/components/brand/page-shell";
import { getSessionUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import { JoinForm } from "./join-form";

export const metadata: Metadata = { title: "Board invite · Corral", robots: { index: false } };
export const dynamic = "force-dynamic";

function WashedAway({ reason }: { reason: string }) {
  return (
    <PageShell>
      <div className="mx-auto max-w-lg rounded-[30px] bg-sea-100 p-8 text-center">
        <svg viewBox="0 0 48 24" aria-hidden="true" className="mx-auto h-8 w-16 text-sea-700">
          <path d="M2 14c5 0 7-8 12-8s7 8 12 8 7-8 12-8 6 4 8 6" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        </svg>
        <h1 className="mt-3 font-display text-[26px] text-tar">This invite washed away</h1>
        <p className="mt-2 text-stone-800">{reason}</p>
        <Link href="/boards" className="mt-5 inline-block font-semibold text-sea-700 underline underline-offset-4">
          Go to your boards
        </Link>
      </div>
    </PageShell>
  );
}

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!z.string().uuid().safeParse(token).success) {
    return <WashedAway reason="This link isn't a valid invite. Ask whoever sent it for a new link." />;
  }

  const user = await getSessionUser();
  if (!user) {
    return (
      <PageShell>
        <div className="mx-auto max-w-lg rounded-[30px] bg-shell-deep p-8 text-center">
          <p className="label text-stone-700">You&apos;re invited</p>
          <h1 className="mt-2 font-display text-[26px] text-tar">Join your roommates on Corral</h1>
          <p className="mt-2 text-stone-700">Sign in with Google to see the board and join it.</p>
          <div className="mt-6 flex justify-center">
            <SignInButton size="lg" next={`/invite/${token}`} />
          </div>
        </div>
      </PageShell>
    );
  }

  const supabase = await createClient();
  const { data } = await supabase!.rpc("invite_preview", { p_token: token });
  const invite = (data as { board_id: string; board_name: string; state: string }[] | null)?.[0];

  if (!invite) return <WashedAway reason="This link isn't a valid invite. Ask whoever sent it for a new link." />;
  if (invite.state === "member") redirect(`/boards/${invite.board_id}`);
  if (invite.state === "expired" || invite.state === "revoked") {
    return <WashedAway reason="It expired or was turned off. Ask whoever sent it for a new link." />;
  }

  return (
    <PageShell>
      <div className="mx-auto max-w-lg rounded-[30px] bg-shell-deep p-8 text-center">
        <p className="label text-stone-700">You&apos;re invited</p>
        <h1 className="mt-2 font-display text-[28px] leading-tight text-tar">{invite.board_name}</h1>
        <p className="mt-2 text-stone-700">
          You&apos;ll join as <strong className="font-semibold text-tar">{user.name}</strong>. Everyone on the board can see and
          edit its places.
        </p>
        <JoinForm token={token} boardName={invite.board_name} />
      </div>
    </PageShell>
  );
}
