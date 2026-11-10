import Link from "next/link";
import { CalendarCheck, Columns3, Link2, MapPinned } from "lucide-react";
import { Band, FenceFooter } from "@/components/brand/band";
import { BoardPreview } from "@/components/brand/board-preview";
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
      <Band>
        <div className="mx-auto max-w-6xl px-4 pb-8 pt-6 sm:px-6 lg:pb-12">
          <div className="flex items-center">
            <Wordmark />
            <Link
              href="/demo"
              className="ml-auto rounded-full bg-shell-light px-4 py-2 font-display text-[15px] text-tar shadow-sm hover:bg-shell-mid"
            >
              Open the demo
            </Link>
          </div>
          <p className="label mt-10 text-tar lg:mt-14">For UCSB roommate groups · Isla Vista & Goleta</p>
          <h1 className="mt-3 max-w-3xl font-display text-[2.6rem] leading-[1.02] text-tar sm:text-6xl">
            Round up your apartment hunt in one corral.
          </h1>
        </div>
      </Band>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-6 lg:py-14">
        <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-16 [&>*]:min-w-0">
          <div>
            <p className="max-w-xl text-lg text-stone-800">
              Stop losing Isla Vista listings in the group chat. Save places from any site, see them on one map,
              compare them side by side, and know who&apos;s following up on what.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Button asChild size="lg">
                <Link href="/demo">Try the demo board</Link>
              </Button>
              <Button asChild size="lg" variant="secondary">
                <Link href="/boards">Sign in to your boards</Link>
              </Button>
            </div>
            <p className="mt-3 text-sm text-stone-700">The demo is fictional and needs no account.</p>
          </div>

          <Link href="/demo" className="block rounded-[32px] transition hover:-translate-y-0.5 motion-reduce:transition-none">
            <span className="sr-only">Open the demo board</span>
            <BoardPreview />
          </Link>
        </div>

        <ul className="mt-16 grid gap-x-8 gap-y-6 border-t border-divider pt-8 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map(({ icon: Icon, title, body }) => (
            <li key={title} className="flex gap-3">
              <Icon className="mt-0.5 h-5 w-5 shrink-0 text-sea-700" strokeWidth={2.75} aria-hidden="true" />
              <div>
                <p className="font-display text-lg text-tar">{title}</p>
                <p className="mt-0.5 text-sm text-stone-700">{body}</p>
              </div>
            </li>
          ))}
        </ul>
      </main>

      <FenceFooter />
    </div>
  );
}
