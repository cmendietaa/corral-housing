import Link from "next/link";
import { Button } from "@/components/ui/button";
import { isSupabaseConfigured } from "@/lib/supabase/env";

const steps = [
  ["Save", "Drop in a listing link and an address. Fill in rent and beds when you know them."],
  ["Map", "See every place on one map of IV and Goleta, linked to its card."],
  ["Compare", "Line up two or three places on the same rows. Unknowns stay Unknown."],
  ["Follow up", "Give each place a status and a next action with an owner and a due date."]
] as const;

export default function Home() {
  const authReady = isSupabaseConfigured();

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center gap-10 px-4 py-16 sm:px-6">
      <header className="space-y-4">
        <p className="text-sm font-semibold uppercase tracking-wide text-moss">Corral</p>
        <h1 className="text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
          One board for your roommate group&apos;s apartment search.
        </h1>
        <p className="max-w-xl text-lg text-muted">
          Stop losing listings in the group chat. Save places from any site, map them, compare
          them side by side, and know who&apos;s following up on what.
        </p>
      </header>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Button asChild size="lg">
          <Link href="/demo">Try the demo</Link>
        </Button>
        <Button size="lg" variant="secondary" disabled={!authReady}>
          {authReady ? "Sign in with Google" : "Sign-in coming soon"}
        </Button>
      </div>
      <p className="-mt-6 text-sm text-muted">
        The demo is a fictional board stored only in your browser. No account needed.
      </p>

      <ol className="grid gap-4 sm:grid-cols-2">
        {steps.map(([title, body], i) => (
          <li key={title} className="rounded-lg border border-line bg-surface p-4">
            <p className="text-sm font-semibold text-moss">
              {i + 1}. {title}
            </p>
            <p className="mt-1 text-sm text-muted">{body}</p>
          </li>
        ))}
      </ol>
    </main>
  );
}
