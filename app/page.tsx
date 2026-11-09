import Link from "next/link";
import { Wordmark } from "@/components/brand/wave-mark";
import { Button } from "@/components/ui/button";
import { isSupabaseConfigured } from "@/lib/supabase/env";

const steps = [
  ["Save", "Drop in a listing link and a name. Add rent and beds when you know them."],
  ["Map", "See every place on one map of IV and Goleta, linked to its card."],
  ["Compare", "Line up two or three places on the same rows. Unknowns stay Unknown."],
  ["Follow up", "Give each place a status and one next step with an owner and a date."]
] as const;

export default function Home() {
  const authReady = isSupabaseConfigured();

  return (
    <div className="flex min-h-screen flex-col">
      <header className="mx-auto w-full max-w-5xl px-4 pt-6 sm:px-6">
        <Wordmark />
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center gap-10 px-4 py-14 sm:px-6">
        <div className="max-w-2xl space-y-5">
          <h1 className="text-4xl font-bold leading-[1.1] tracking-tight text-ink sm:text-6xl">
            Your roommate group&apos;s apartment hunt, on one board.
          </h1>
          <p className="max-w-xl text-lg leading-relaxed text-muted">
            Stop losing Isla Vista listings in the group chat. Save places from any site, see them on a
            map, compare them side by side, and know who&apos;s following up on what.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Button asChild size="lg">
            <Link href="/demo">Try the demo board</Link>
          </Button>
          <Button size="lg" variant="secondary" disabled={!authReady}>
            {authReady ? "Sign in with Google" : "Sign-in coming soon"}
          </Button>
          <p className="text-sm text-muted sm:ml-2">No account needed for the demo.</p>
        </div>

        <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map(([title, body], i) => (
            <li key={title} className="rounded-lg border border-line bg-surface p-4 shadow-soft">
              <p className="flex items-center gap-2 font-semibold text-ink">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-ocean-soft text-xs font-bold text-ocean">
                  {i + 1}
                </span>
                {title}
              </p>
              <p className="mt-2 text-sm leading-relaxed text-muted">{body}</p>
            </li>
          ))}
        </ol>
      </main>

      <footer className="border-t border-line">
        <p className="mx-auto max-w-5xl px-4 py-4 text-xs text-muted sm:px-6">
          Not affiliated with UCSB. Demo data is fictional.
        </p>
      </footer>
    </div>
  );
}
