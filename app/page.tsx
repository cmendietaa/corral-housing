import Link from "next/link";
import { FenceFooter } from "@/components/brand/band";
import { Wordmark } from "@/components/brand/wave-mark";
import { Reveal } from "@/components/landing/reveal";
import { cn } from "@/lib/utils";

/**
 * The landing page: the sunset band with three postcards from the app tossed on
 * the sand, then three scenes on alternating sea and sand, what's in the
 * corral as a fence, and the gate. Motion is calm and stops for reduced motion.
 */
export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-shell">
      <Hero />
      <Wave color="var(--color-sea-700)" back="var(--color-sea-500)" bg="bg-sea-800" />
      <RoundItUp />
      <Wave color="var(--color-sea-800)" back="var(--color-sea-300)" bg="bg-shell" />
      <KeepItMoving />
      <PickTheOne />
      <Wave color="var(--color-sunset-200)" back="var(--color-sunset-300)" bg="bg-sea-900" />
      <WhatsInside />
      <Wave color="var(--color-sea-900)" back="var(--color-sea-700)" bg="bg-sunset-300" />
      <Closing />
      <FenceFooter />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pieces

const FENCE = ["bg-sea-700", "bg-sunset-500", "bg-glass-500", "bg-sea-300", "bg-sunset-300"] as const;

/** The tide where one band meets the next: two swells drifting past each other. */
function Wave({ color, back, bg }: { color: string; back: string; bg: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn("corral-tide corral-tide-drift", bg)}
      style={{ ["--tide-front" as string]: color, ["--tide-back" as string]: back }}
    />
  );
}

/** A little drawn photo: sky, a house, the street. */
function Snap({ wall = "#f1ece2", className }: { wall?: string; className?: string }) {
  return (
    <span aria-hidden="true" className={cn("relative block overflow-hidden rounded-[16px] bg-[#bfe0f2]", className)}>
      <span className="absolute inset-x-0 top-0 h-[38%] bg-[#d6ecf8]" />
      <span className="absolute left-1/2 top-[18%] h-[18%] w-[56%] -translate-x-1/2 bg-[#4c5566] [clip-path:polygon(8%_100%,50%_0,92%_100%)]" />
      <span className="absolute inset-x-[16%] top-[35%] h-[40%]" style={{ background: wall }} />
      <span className="absolute left-[24%] top-[44%] h-[12%] w-[14%] bg-[#6f8aa3]" />
      <span className="absolute right-[24%] top-[44%] h-[12%] w-[14%] bg-[#6f8aa3]" />
      <span className="absolute inset-x-0 bottom-0 h-[26%] bg-[#8b8f94]" />
      <span className="absolute bottom-[8%] left-[6%] h-[11%] w-[30%] rounded-md bg-[#c9ccd2]" />
    </span>
  );
}

/** Five stars filled to `value` (out of 5); they fill in when their section appears. */
function Stars({ value, className }: { value: number; className?: string }) {
  const star = "M12 2.6l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17.4l-5.8 3.1 1.1-6.5-4.7-4.6 6.5-.9z";
  const row = (fill: boolean) => (
    <span className="flex gap-0.5">
      {Array.from({ length: 5 }, (_, i) => (
        <svg key={i} viewBox="0 0 24 24" className="h-[18px] w-[18px] shrink-0 text-sunset-600" fill={fill ? "var(--color-sunset-500)" : "none"} stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden="true">
          <path d={star} />
        </svg>
      ))}
    </span>
  );
  return (
    <span role="img" aria-label={`${value} out of 5`} className={cn("relative inline-block", className)}>
      {row(false)}
      <span className="reveal-fill absolute inset-y-0 left-0 overflow-hidden" style={{ width: `${(value / 5) * 100}%`, ["--fill" as string]: `${(value / 5) * 100}%` }}>
        {row(true)}
      </span>
    </span>
  );
}

/** A row of fence boards that stand up one after another. */
function Fence({ heights, className, boardClass = "w-3.5" }: { heights: number[]; className?: string; boardClass?: string }) {
  return (
    <span aria-hidden="true" className={cn("flex items-end gap-1.5", className)}>
      {heights.map((h, i) => (
        <span
          key={i}
          className={cn("reveal-board block rounded-t-full rounded-b-[2px]", boardClass, FENCE[i % FENCE.length])}
          style={{ height: h, ["--i" as string]: i }}
        />
      ))}
    </span>
  );
}

const btn = "inline-flex h-14 items-center justify-center rounded-full px-7 font-display text-[19px] transition focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-focus";

// ---------------------------------------------------------------------------
// Sections

function Hero() {
  return (
    <section className="relative overflow-hidden bg-sunset-300">
      <span aria-hidden="true" className="corral-sun-rest absolute left-1/2 top-[300px] h-[340px] w-[340px] rounded-full bg-sunset-200 max-sm:top-[260px] max-sm:h-[240px] max-sm:w-[240px]" />
      <div className="relative mx-auto flex max-w-6xl items-center px-5 pt-6 sm:px-8">
        <Wordmark />
        <Link href="/boards" className="ml-auto rounded-full bg-shell-light px-4 py-2 font-display text-[15px] text-tar shadow-sm hover:bg-shell">
          Sign in
        </Link>
      </div>
      <div className="relative mx-auto max-w-3xl px-5 pt-12 text-center sm:pt-16">
        <h1 className="font-display text-[2.7rem] leading-[1.02] text-tar sm:text-[4.1rem]">Every place your group finds, in one corral.</h1>
        <p className="mx-auto mt-4 max-w-xl text-lg text-stone-800">For roommate groups hunting in Isla Vista and Goleta.</p>
        <Link href="/demo" className={cn(btn, "mt-7 bg-sunset-500 text-tar shadow-sm hover:bg-sunset-400")}>
          Try the demo board
        </Link>
      </div>

      {/* Postcards from the app, tossed on the sand at the water's edge. */}
      <div className="relative mt-12 h-[360px] sm:mt-14">
        <div aria-hidden="true" className="absolute inset-x-0 bottom-0 h-[46%]">
          <div className="h-2 bg-sunset-400" />
          <div className="h-2 bg-sunset-500" />
          <div className="h-2.5 bg-sea-500" />
          <div className="h-full bg-sea-700" />
        </div>
        <div className="relative mx-auto h-full max-w-6xl" aria-hidden="true">
          <Postcard i={0} r={-5} className="left-[3%] top-2 w-[62%] sm:left-[4%] sm:top-4 sm:w-[300px]">
            <Snap className="h-[150px] rounded-none" wall="#e8d9c4" />
            <div className="p-3.5">
              <div className="flex items-baseline justify-between gap-2 font-display text-[17px] text-tar">
                <span>Del Playa, 6680</span>
                <span>$7,200</span>
              </div>
              <span className="mt-2 inline-flex items-center gap-1.5 rounded-l-[9px] rounded-r-[16px] bg-st-applied-bg py-1.5 pl-2 pr-3 text-[13px] font-bold text-st-applied">
                <span className="h-1.5 w-1.5 rounded-full bg-shell-light" />
                Move to Applied
              </span>
            </div>
          </Postcard>
          <Postcard i={1} r={2} className="left-[38%] top-16 hidden w-[300px] p-4 sm:block">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-7 items-center justify-center rounded-t-full rounded-b-[5px] bg-sunset-500 font-display text-[16px] text-tar">1</span>
              <span className="font-display text-[18px] text-tar">Sabado Tarde, 6512</span>
            </div>
            <div className="mt-2.5 flex items-center gap-2">
              <Stars value={4.3} />
              <span className="font-display text-lg text-tar">4.3</span>
              <span className="text-sm font-bold text-stone-800">· Great fit</span>
            </div>
            <div className="mt-2.5 flex flex-col items-start gap-1.5 text-[13px]">
              <span className="rounded-full bg-glass-200 px-3 py-1 text-glass-900">+ 1 min bike to campus</span>
              <span className="rounded-full bg-sunset-200/80 px-3 py-1 text-sunset-900">− $50 under your max</span>
            </div>
          </Postcard>
          <Postcard i={2} r={6} className="right-[3%] top-[150px] w-[56%] p-3.5 sm:right-[4%] sm:top-2 sm:w-[300px] sm:p-4">
            <p className="font-display text-[18px] text-tar">Rounded up 6 details</p>
            <Fence heights={[26, 32, 22, 30, 34, 24]} className="mt-2.5" boardClass="w-3" />
            <div className="mt-3 grid grid-cols-3 gap-2">
              {[
                ["Rent", "$2,750"],
                ["Beds", "Studio"],
                ["Baths", "1"]
              ].map(([l, v]) => (
                <div key={l} className="rounded-[12px] border-[1.5px] border-sunset-400 bg-sunset-100 p-2">
                  <p className="text-[11px] font-bold text-stone-800">{l}</p>
                  <p className="font-display text-[16px] text-tar">{v}</p>
                </div>
              ))}
            </div>
          </Postcard>
        </div>
      </div>
    </section>
  );
}

function Postcard({ i, r, className, children }: { i: number; r: number; className?: string; children: React.ReactNode }) {
  return (
    <div
      className={cn("corral-postcard absolute overflow-hidden rounded-[22px] bg-shell-light shadow-[0_14px_32px_rgb(32_30_29/0.2)]", className)}
      style={{ ["--r" as string]: `${r}deg`, ["--i" as string]: i }}
    >
      {children}
    </div>
  );
}

/** A section's words: a small label, a headline, one line. */
function Words({ label, title, body, tone }: { label: string; title: string; body: string; tone: "dark" | "light" }) {
  return (
    <div className="reveal-up">
      <p className={cn("text-xs font-bold uppercase tracking-[0.14em]", tone === "dark" ? "text-sunset-300" : "text-sunset-700")}>{label}</p>
      <h2 className={cn("mt-3 font-display text-[2.2rem] leading-[1.05] sm:text-[2.75rem]", tone === "dark" ? "text-shell" : "text-tar")}>{title}</h2>
      <p className={cn("mt-4 max-w-md text-lg leading-relaxed", tone === "dark" ? "text-sea-100" : "text-stone-800")}>{body}</p>
    </div>
  );
}

function RoundItUp() {
  return (
    <Reveal as="section" className="bg-sea-800">
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 py-20 sm:px-8 lg:grid-cols-2 lg:gap-16 lg:py-28">
        <Words
          tone="dark"
          label="Round it up"
          title="Paste a link. Corral fills in the rest."
          body="A listing, a group-chat message or a screenshot. Rent, beds, baths and lease dates fill in for you to check."
        />
        <div className="reveal-up rounded-[30px] bg-shell-deep p-5 sm:p-6" style={{ ["--i" as string]: 1 }}>
          <div className="overflow-hidden rounded-[18px] bg-shell-light">
            <div className="h-2 bg-[linear-gradient(90deg,var(--color-sunset-400)_0_22%,var(--color-sunset-500)_22%_40%,var(--color-sea-500)_40%_62%,var(--color-sea-700)_62%)]" />
            <p className="px-4 py-3.5 text-[15px] text-stone-700">rlwa.com/listings/6531-del-playa-06</p>
          </div>
          <div className="mt-4 flex items-end gap-3">
            <Fence heights={[30, 38, 26, 34, 40, 28]} />
            <span className="font-display text-xl text-tar">Rounded up 6 details</span>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2.5">
            {[
              ["Rent", "$2,750"],
              ["Bedrooms", "Studio"],
              ["Bathrooms", "1"]
            ].map(([l, v], i) => (
              <div key={l} className="reveal-up rounded-[16px] border-[1.5px] border-sunset-400 bg-sunset-100 px-3 py-2.5" style={{ ["--i" as string]: i + 2 }}>
                <p className="text-xs font-bold text-stone-800">{l}</p>
                <p className="font-display text-[22px] text-tar">{v}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Reveal>
  );
}

const STAGES = [
  { name: "Considering", wash: "bg-stone-300/60", h: "h-[230px]", wall: "#efe4d3" },
  { name: "Contacted", wash: "bg-sunset-200", h: "h-[262px]", wall: "#f1ece2" },
  { name: "Tour", wash: "bg-glass-200", h: "h-[290px]", wall: "#e8d9c4" },
  { name: "Applied", wash: "bg-glass-300/70", h: "h-[252px]", wall: "#f3e6d6" }
];

function KeepItMoving() {
  return (
    <Reveal as="section" className="bg-shell">
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 py-20 sm:px-8 lg:grid-cols-2 lg:gap-16 lg:py-28">
        <div className="flex h-[300px] items-end gap-2.5 max-lg:order-2" aria-hidden="true">
          {STAGES.map((s, i) => (
            <div
              key={s.name}
              className={cn("reveal-board flex flex-1 flex-col items-center gap-2 rounded-t-[90px] rounded-b-[18px] px-2 pb-2 pt-6", s.wash, s.h)}
              style={{ ["--i" as string]: i }}
            >
              <span className="text-center font-display text-[14px] leading-tight text-tar sm:text-[15px]">{s.name}</span>
              <Snap className="h-14 w-full" wall={s.wall} />
            </div>
          ))}
        </div>
        <Words
          tone="light"
          label="Keep it moving"
          title="Everyone sees where each place stands."
          body="Considering, contacted, touring, applied. One next step per place, with a who and a when."
        />
      </div>
    </Reveal>
  );
}

function PickTheOne() {
  return (
    <Reveal as="section" className="bg-sunset-200">
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 py-20 sm:px-8 lg:grid-cols-2 lg:gap-16 lg:py-28">
        <Words tone="light" label="Pick the one" title="Rank by what matters to you." body="Set a budget and what counts. Corral says which place fits best, and why." />
        <div className="reveal-up flex gap-4 rounded-[26px] bg-shell-light p-4 shadow-sm max-sm:flex-col" style={{ ["--i" as string]: 1 }}>
          <Snap className="h-[124px] w-full shrink-0 sm:w-[170px]" />
          <div className="min-w-0">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-7 items-center justify-center rounded-t-full rounded-b-[5px] bg-sunset-500 font-display text-[16px] text-tar">1</span>
              <span className="font-display text-[20px] text-tar">Sabado Tarde, 6512</span>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <Stars value={4.3} />
              <span className="font-display text-lg text-tar">4.3</span>
              <span className="text-sm font-bold text-stone-800">· Great fit</span>
            </div>
            <div className="mt-2.5 flex flex-wrap gap-1.5 text-[13px]">
              <span className="rounded-full bg-glass-200 px-3 py-1 text-glass-900">+ 1 min bike to campus</span>
              <span className="rounded-full bg-sunset-200/80 px-3 py-1 text-sunset-900">− $50 under your max</span>
            </div>
          </div>
        </div>
      </div>
    </Reveal>
  );
}

const INSIDE = [
  { title: "Round it up", body: "Paste a link, a post or a screenshot.", cls: "bg-sunset-500 text-tar", h: "lg:h-[340px]" },
  { title: "One map", body: "Every place as a rent tag, with the bike time to campus.", cls: "bg-sea-500 text-shell", h: "lg:h-[380px]" },
  { title: "Pick the one", body: "Stars for what matters to you, and why.", cls: "bg-glass-500 text-tar", h: "lg:h-[360px]" },
  { title: "Keep it moving", body: "Who calls the landlord, and by when.", cls: "bg-sunset-300 text-tar", h: "lg:h-[400px]" }
];

function WhatsInside() {
  return (
    <Reveal as="section" className="bg-sea-900">
      <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8 lg:py-24">
        <h2 className="reveal-up text-center font-display text-[2.2rem] text-shell sm:text-[2.6rem]">What&apos;s in the corral</h2>
        <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:items-end">
          {INSIDE.map((b, i) => (
            <li
              key={b.title}
              className={cn("reveal-board flex min-h-[200px] flex-col justify-end gap-2 rounded-t-[140px] rounded-b-[22px] px-6 pb-6 pt-20", b.cls, b.h)}
              style={{ ["--i" as string]: i }}
            >
              <h3 className="font-display text-[26px] leading-tight">{b.title}</h3>
              <p className="text-[16px] leading-snug opacity-90">{b.body}</p>
            </li>
          ))}
        </ul>
      </div>
    </Reveal>
  );
}

function Closing() {
  return (
    <Reveal as="section" className="relative overflow-hidden bg-sunset-300">
      <span aria-hidden="true" className="absolute bottom-0 left-1/2 h-[260px] w-[260px] -translate-x-1/2 translate-y-[40%] rounded-full bg-sunset-200" />
      <div className="relative mx-auto max-w-3xl px-5 py-20 text-center sm:py-24">
        <h2 className="reveal-up font-display text-[2.4rem] leading-tight text-tar sm:text-[3rem]">The gate&apos;s open.</h2>
        <p className="reveal-up mt-3 text-lg text-stone-800" style={{ ["--i" as string]: 1 }}>
          Free for roommate groups in Isla Vista and Goleta.
        </p>
        <div className="reveal-up mt-8 flex flex-col justify-center gap-3 sm:flex-row" style={{ ["--i" as string]: 2 }}>
          <Link href="/demo" className={cn(btn, "bg-sunset-500 text-tar shadow-sm hover:bg-sunset-400")}>
            Try the demo board
          </Link>
          <Link href="/boards" className={cn(btn, "border-[1.5px] border-tar bg-shell-light text-tar hover:bg-shell")}>
            Start your board
          </Link>
        </div>
      </div>
    </Reveal>
  );
}
