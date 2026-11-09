import Link from "next/link";
import { CalendarCheck, Columns3, Link2, MapPinned } from "lucide-react";
import { BoardPreview } from "@/components/brand/board-preview";
import { Shoreline } from "@/components/brand/shoreline";
import { Wordmark } from "@/components/brand/wave-mark";
import { Button } from "@/components/ui/button";

const steps = [
  { icon: Link2, title: "Save", body: "Paste a listing link from any site." },
  { icon: MapPinned, title: "Map", body: "Every place on one map of IV and Goleta." },
  { icon: Columns3, title: "Compare", body: "Two or three side by side. Unknowns stay unknown." },
  { icon: CalendarCheck, title: "Follow up", body: "One next step per place, with a who and a when." }
] as const;

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="mx-auto flex w-full max-w-6xl items-center px-4 pt-6 sm:px-6">
        <Wordmark />
        <Link
          href="/demo"
          className="ml-auto rounded-full px-3 py-1.5 text-sm font-semibold text-ocean hover:bg-ocean-soft focus-visible:outline-2 focus-visible:outline-focus"
        >
          Open the demo
        </Link>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-12 sm:px-6 lg:py-20">
        <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-16 [&>*]:min-w-0">
          <div>
            <h1 className="font-display text-[2.4rem] font-extrabold leading-[1.02] text-ink sm:text-6xl">
              Your roommate group&apos;s apartment hunt, on one board.
            </h1>
            <Shoreline className="mt-6 max-w-md" />
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted">
              Stop losing Isla Vista listings in the group chat. Save places from any site, see them on a map,
              compare them side by side, and know who&apos;s following up on what.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Button asChild size="lg">
                <Link href="/demo">Try the demo board</Link>
              </Button>
              {/* Enabled once Google sign-in and private boards ship (PLAN.md days 4–6). */}
              <Button size="lg" variant="secondary" disabled>
                Sign-in coming soon
              </Button>
            </div>
            <p className="mt-3 text-sm text-muted">The demo is fictional and needs no account.</p>
          </div>

          <Link
            href="/demo"
            className="block rounded-xl transition hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-focus motion-reduce:transition-none"
          >
            <span className="sr-only">Open the demo board</span>
            <BoardPreview />
          </Link>
        </div>

        <ul className="mt-16 grid gap-x-8 gap-y-6 border-t border-line pt-8 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map(({ icon: Icon, title, body }) => (
            <li key={title} className="flex gap-3">
              <Icon className="mt-0.5 h-5 w-5 shrink-0 text-ocean" aria-hidden="true" />
              <div>
                <p className="font-display font-bold text-ink">{title}</p>
                <p className="mt-0.5 text-sm leading-relaxed text-muted">{body}</p>
              </div>
            </li>
          ))}
        </ul>
      </main>

      <footer className="border-t border-line">
        <p className="mx-auto max-w-6xl px-4 py-4 text-xs text-muted sm:px-6">
          Not affiliated with UCSB. Demo data is fictional.
        </p>
      </footer>
    </div>
  );
}
