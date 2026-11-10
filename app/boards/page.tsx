import type { Metadata } from "next";
import Link from "next/link";
import { SignInButton } from "@/components/auth/sign-in-button";
import { PageShell, SignOutButton } from "@/components/brand/page-shell";
import { CrewPill } from "@/components/brand/band";
import { getSessionUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import { NewBoardForm } from "./new-board-form";

export const metadata: Metadata = { title: "Your boards · Corral" };
export const dynamic = "force-dynamic";

type BoardRow = {
  id: string;
  name: string;
  lease_year: string;
  board_members: { user_id: string; display_name: string }[];
  listings: { count: number }[];
};

export default async function BoardsPage({ searchParams }: { searchParams: Promise<{ signin?: string }> }) {
  const { signin } = await searchParams;
  const user = await getSessionUser();

  if (!user) {
    return (
      <PageShell title="Your boards">
        <div className="mx-auto max-w-lg rounded-[30px] bg-shell-deep p-8 text-center">
          <h2 className="font-display text-[26px] text-tar">Sign in to see your boards</h2>
          <p className="mt-2 text-stone-700">
            Private boards are shared only with the roommates you invite. Sign in with Google to start one or open yours.
          </p>
          {signin === "failed" ? (
            <p role="alert" className="mt-3 text-sm font-semibold text-danger">
              Sign-in didn&apos;t finish. Try again.
            </p>
          ) : null}
          <div className="mt-6 flex justify-center">
            <SignInButton size="lg" next="/boards" />
          </div>
          <p className="mt-4 text-sm text-stone-700">
            Just looking? <Link href="/demo" className="font-semibold text-sea-700 underline underline-offset-4">Try the demo board</Link>.
          </p>
        </div>
      </PageShell>
    );
  }

  const supabase = await createClient();
  // RLS returns only boards this user is a member of.
  const { data, error } = await supabase!
    .from("boards")
    .select("id, name, lease_year, board_members(user_id, display_name), listings(count)")
    .order("created_at", { ascending: false });
  const boards = (data ?? []) as unknown as BoardRow[];

  return (
    <PageShell title="Your boards" right={<SignOutButton />}>
      <p className="label text-stone-700">Signed in as {user.email ?? user.name}</p>
      <h2 className="mt-2 font-display text-[32px] leading-tight text-tar">Your boards</h2>

      {error ? (
        <p role="alert" className="mt-4 rounded-[22px] bg-sunset-100 px-5 py-3 text-danger">
          Couldn&apos;t load your boards. Refresh to try again.
        </p>
      ) : null}

      {boards.length > 0 ? (
        <ul className="mt-6 grid gap-3 sm:grid-cols-2">
          {boards.map((b) => (
            <li key={b.id}>
              <Link
                href={`/boards/${b.id}`}
                className="flex items-center gap-4 rounded-[26px] bg-shell-light p-5 shadow-sm transition hover:bg-shell-mid"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-display text-xl text-tar">{b.name}</span>
                  <span className="mt-1 block text-sm text-stone-700">
                    {[b.lease_year ? `Lease ${b.lease_year}` : null, `${b.listings[0]?.count ?? 0} places`].filter(Boolean).join(" · ")}
                  </span>
                </span>
                <span className="flex items-end gap-1" aria-label={`${b.board_members.length} roommates`}>
                  {b.board_members.slice(0, 5).map((m, i) => (
                    <CrewPill key={m.user_id} name={m.display_name} index={i} size="sm" />
                  ))}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-stone-700">No boards yet. Start one below, or open an invite link a roommate sent you.</p>
      )}

      <div className="mt-8">
        <NewBoardForm />
      </div>
    </PageShell>
  );
}
