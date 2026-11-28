"use client";

import { motion } from "motion/react";
import { MOVE } from "@/lib/motion";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Minus, Plus, SlidersHorizontal } from "lucide-react";
import { streetHeadline } from "@/lib/address";
import { formatRent, groupSizeOf } from "@/lib/compare";
import { centsToDollarsInput, parseDollars } from "@/lib/format";
import { isClosedStatus, type Board, type Listing } from "@/lib/listing";
import {
  FACTORS,
  FACTOR_LABELS,
  LEVEL_LABELS,
  defaultPriorities,
  formatStars,
  headline,
  rankPlaces,
  type Factor,
  type HeldPlace,
  type Level,
  type Priorities,
  type RankedPlace,
  type Requirement
} from "@/lib/rank";
import { RopeInToggle } from "@/components/brand/controls";
import { EmptyLot, FENCE_COLORS, FitStars } from "@/components/brand/motifs";
import { cn } from "@/lib/utils";
import { FinePrint } from "@/components/brand/band";
import { Button } from "@/components/ui/button";
import { StreetPhoto } from "./street-photo";

const storageKey = (boardId: string) => `corral:rank:${boardId}`;

/** Each viewer's priorities for this board, on this device only. */
function usePriorities(board: Board) {
  const defaults = useMemo(() => defaultPriorities({ budgetPerPersonCents: board.budgetPerPersonCents }), [board.budgetPerPersonCents]);
  const [priorities, setPriorities] = useState<Priorities>(() => {
    try {
      const raw = window.localStorage.getItem(storageKey(board.id));
      if (raw) {
        const saved = JSON.parse(raw) as Partial<Priorities>;
        return { ...defaults, ...saved, weights: { ...defaults.weights, ...saved.weights } };
      }
    } catch {
      // Private mode or bad data: use the board's defaults.
    }
    return defaults;
  });
  const update = (next: Priorities) => {
    setPriorities(next);
    try {
      window.localStorage.setItem(storageKey(board.id), JSON.stringify(next));
    } catch {
      // Not saved; it still works for this visit.
    }
  };
  const reset = () => {
    setPriorities(defaults);
    try {
      window.localStorage.removeItem(storageKey(board.id));
    } catch {
      // Nothing to remove.
    }
  };
  return { priorities, update, reset };
}

const REQUIREMENT_LABELS: Record<Requirement, string> = {
  maxRent: "max rent",
  minBeds: "minimum bedrooms",
  moveInBy: "move-in date",
  laundry: "laundry",
  parking: "parking"
};

type Props = {
  /** The fine print's note under the list (desktop). */
  footNote?: string | null;
  listings: Listing[];
  board: Board;
  photos: boolean;
  checked: string[];
  checkDisabled: (id: string) => boolean;
  onToggleCheck: (id: string) => void;
  onCompare: (ids: string[]) => void;
  onOpen: (id: string) => void;
  onEdit: (id: string) => void;
};

/** The Rank tab: your priorities on the left, the places that fit them best on the right. */
export function RankView({ footNote, listings, board, photos, checked, checkDisabled, onToggleCheck, onCompare, onOpen, onEdit }: Props) {
  const { priorities, update, reset } = usePriorities(board);
  const people = groupSizeOf(board);
  const ranking = useMemo(() => rankPlaces(listings, priorities, people, board.meId ?? null), [listings, priorities, people, board.meId]);
  const [editing, setEditing] = useState(false);
  const openCount = ranking.ranked.length + ranking.missingInfo.length + ranking.doesntMeet.length;
  const top = ranking.ranked.slice(0, 3).map((r) => r.place.id);
  const closedCount = listings.filter((l) => isClosedStatus(l.status)).length;

  const panel = <PrioritiesPanel priorities={priorities} onChange={update} onReset={reset} />;

  return (
    <div className="pb-28 lg:grid lg:h-full lg:grid-cols-[360px_minmax(0,1fr)] lg:grid-rows-[minmax(0,1fr)] lg:gap-6 lg:pb-0">
      {/* Desktop: priorities beside the list. Each side scrolls on its own. */}
      <aside aria-label="Your priorities" className="pane-scroll hidden lg:block lg:min-h-0 lg:overflow-y-auto lg:overscroll-contain lg:py-5">
        <div className="rounded-[32px] bg-shell-deep p-5">{panel}</div>
      </aside>

      {/* Phones: a summary that opens the priorities */}
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="mb-4 flex w-full items-center gap-3 rounded-[22px] bg-shell-deep px-4 py-3 text-left lg:hidden"
      >
        <SlidersHorizontal className="h-4 w-4 shrink-0 text-tar" strokeWidth={2.75} aria-hidden="true" />
        <span className="min-w-0 flex-1 truncate text-sm text-tar">{summary(priorities)}</span>
        <span className="text-sm font-semibold text-sea-900 underline underline-offset-4">Edit</span>
      </button>
      {editing ? <PrioritiesSheet onClose={() => setEditing(false)}>{panel}</PrioritiesSheet> : null}

      <section aria-label="Ranked places" className="pane-scroll min-w-0 lg:min-h-0 lg:overflow-y-auto lg:overscroll-contain lg:py-5 lg:pr-2">
       <div className="max-w-[820px] space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-[26px] leading-tight text-tar max-lg:sr-only">Best fit for you</h2>
            {openCount > 0 ? (
              <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-stone-800">
                {/* One board per open place; the ones that fit stand in color. */}
                <span aria-hidden="true" className="flex items-end gap-[3px]">
                  {Array.from({ length: Math.min(openCount, 12) }, (_, i) => (
                    <span
                      key={i}
                      className={cn(
                        "block w-2 rounded-t-full rounded-b-[2px]",
                        i < ranking.ranked.length ? FENCE_COLORS[i % FENCE_COLORS.length] : "ring-[1.5px] ring-inset ring-stone-400"
                      )}
                      style={{ height: [18, 22, 16, 20, 17, 21][i % 6] }}
                    />
                  ))}
                </span>
                <span>
                  <span className="font-display text-base text-tar">
                    {ranking.ranked.length} of {openCount}
                  </span>{" "}
                  open {openCount === 1 ? "place fits" : "places fit"} your must-haves
                </span>
              </p>
            ) : null}
          </div>
          {top.length >= 2 ? (
            <Button size="sm" variant="secondary" onClick={() => onCompare(top)}>
              Compare top {top.length}
            </Button>
          ) : null}
        </div>

        <Notes ranking={ranking} openCount={openCount} />

        {ranking.ranked.length > 0 ? (
          <ol className="space-y-3">
            {ranking.ranked.map((r) => (
              <motion.li key={r.place.id} layout="position" transition={MOVE}>
                <RankCard
                  r={r}
                  photos={photos}
                  checked={checked.includes(r.place.id)}
                  checkDisabled={checkDisabled(r.place.id)}
                  onToggleCheck={() => onToggleCheck(r.place.id)}
                  onOpen={() => onOpen(r.place.id)}
                />
              </motion.li>
            ))}
          </ol>
        ) : null}

        {ranking.missingInfo.length > 0 ? (
          <HeldSection
            title={`Might fit, but missing info · ${ranking.missingInfo.length}`}
            items={ranking.missingInfo}
            action={{ label: "Fill in", onClick: onEdit }}
            photos={photos}
            onOpen={onOpen}
          />
        ) : null}

        {ranking.doesntMeet.length > 0 ? (
          <HeldSection
            title={`Doesn't meet your must-haves · ${ranking.doesntMeet.length}`}
            items={ranking.doesntMeet}
            photos={photos}
            dim
            onOpen={onOpen}
          />
        ) : null}

        {closedCount > 0 ? (
          <p className="px-2 text-[13px] text-stone-700">
            {closedCount} washed-out {closedCount === 1 ? "place isn't" : "places aren't"} ranked (Passed or Unavailable).
          </p>
        ) : null}
        <FinePrint note={footNote} className="hidden pt-6 lg:flex" />
       </div>
      </section>
    </div>
  );
}

function summary(p: Priorities): string {
  const top = FACTORS.filter((f) => p.weights[f] === 3).map((f) => FACTOR_LABELS[f].toLowerCase());
  return [
    p.maxRentPerPersonCents !== null ? `Max ${formatRent(p.maxRentPerPersonCents)}/person` : "No max rent",
    p.minBeds ? `${p.minBeds}+ bd` : null,
    top.length ? `${top[0]![0]!.toUpperCase()}${top[0]!.slice(1)} matters most` : null
  ]
    .filter(Boolean)
    .join(" · ");
}

function Notes({ ranking, openCount }: { ranking: ReturnType<typeof rankPlaces>; openCount: number }) {
  const notes: { tag?: string; text: string }[] = [];
  if (openCount < 2) notes.push({ text: "Add a few places to rank them." });
  else if (!ranking.ranked.length && ranking.tightest)
    notes.push({ tag: "Too strict", text: `No place meets all your requirements. The ${REQUIREMENT_LABELS[ranking.tightest]} rules out the most; loosen it?` });
  if (ranking.allDontCare) notes.push({ text: "Everything is set to Don't care, so places are ranked by price." });
  if (ranking.noPins) notes.push({ tag: "No pins", text: "Bike time can't count until places have pins on the map." });
  if (ranking.closeCall && ranking.ranked.length >= 2)
    notes.push({ tag: "Close call", text: `#1 changes with how much ${FACTOR_LABELS[ranking.closeCall].toLowerCase()} matters.` });
  if (!notes.length) return null;
  return (
    <ul className="space-y-2">
      {notes.map((n) => (
        <li key={n.text} className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-sm text-stone-800">
          {n.tag ? (
            // A rope tag: knot dot on the left, rounded on the right.
            <span className="inline-flex items-center gap-1.5 rounded-l-[8px] rounded-r-[14px] bg-sunset-200 py-1 pl-2 pr-3 text-xs font-bold text-sunset-800">
              <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-shell-light" />
              {n.tag}
              <span className="sr-only">:</span>
            </span>
          ) : null}
          <span>{n.text}</span>
        </li>
      ))}
    </ul>
  );
}

// ---------------------------------------------------------------------------
// Cards

function RankCard({
  r,
  photos,
  checked,
  checkDisabled,
  onToggleCheck,
  onOpen
}: {
  r: RankedPlace<Listing>;
  photos: boolean;
  checked: boolean;
  checkDisabled: boolean;
  onToggleCheck: () => void;
  onOpen: () => void;
}) {
  const [why, setWhy] = useState(false);
  const whyId = useId();
  const name = streetHeadline(r.place.address, r.place.title);
  const line = headline(r);
  const score = formatStars(r);

  return (
    <article aria-label={`#${r.rank} ${name}, ${score} out of 5`} className="rounded-[28px] bg-shell p-2.5 shadow-sm sm:p-3">
      <div className="flex items-start gap-3 sm:gap-4">
        <div className="h-[92px] w-[120px] shrink-0 overflow-hidden rounded-[18px] sm:h-[124px] sm:w-[170px] sm:rounded-[20px]">
          {r.place.lat === null ? (
            <EmptyLot />
          ) : (
            <StreetPhoto listingId={r.place.id} lat={r.place.lat} lng={r.place.lng} label={name} size="card" enabled={photos} attribution="tiny" className="h-full w-full" />
          )}
        </div>
        <div className="min-w-0 flex-1 pt-0.5">
          <div className="flex items-start gap-2.5">
            {/* The rank on a little fence board: the top three in sunset. */}
            <span
              aria-hidden="true"
              className={cn(
                "flex h-9 w-7 shrink-0 items-center justify-center rounded-t-full rounded-b-[5px] font-display text-[16px] leading-none text-tar",
                r.rank === 1 ? "bg-sunset-500" : r.rank === 2 ? "bg-sunset-400" : r.rank === 3 ? "bg-sunset-300" : "bg-shell-deep"
              )}
            >
              {r.rank}
            </span>
            <button type="button" onClick={onOpen} className="min-w-0 flex-1 pt-1 text-left font-display text-[17px] leading-tight text-tar hover:underline sm:text-[19px]">
              {name}
            </button>
          </div>
          <FitStars stars={r.score / 20} text={score} className="mt-2" />
          {line.length ? (
            <ul className="mt-2 flex flex-wrap gap-1.5 text-[13px] leading-snug">
              {line.map((x) => (
                <li
                  key={x.factor}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full py-1 pl-1.5 pr-3",
                    x.sign === "+" ? "bg-glass-200 text-glass-900" : "bg-sunset-200/80 text-sunset-900"
                  )}
                >
                  <span
                    aria-hidden="true"
                    className={cn("flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full text-shell-light", x.sign === "+" ? "bg-glass-600" : "bg-sunset-600")}
                  >
                    {x.sign === "+" ? <Plus className="h-3 w-3" strokeWidth={3.5} /> : <Minus className="h-3 w-3" strokeWidth={3.5} />}
                  </span>
                  <span className="sr-only">{x.sign === "+" ? "Plus: " : "Minus: "}</span>
                  {x.text}
                </li>
              ))}
            </ul>
          ) : null}
          {r.missing.length ? (
            <p className="mt-1.5 flex flex-wrap gap-1.5">
              {r.missing.map((f) => (
                <span key={f} className="rounded-full bg-sunset-100 px-2.5 py-0.5 text-xs font-semibold text-tar">
                  {MISSING_LABEL[f]} unknown
                </span>
              ))}
            </p>
          ) : null}
          <div className="mt-1 flex items-center gap-4">
            <button
              type="button"
              aria-expanded={why}
              aria-controls={whyId}
              onClick={() => setWhy((w) => !w)}
              className="inline-flex h-9 items-center gap-1 text-[13px] font-semibold text-sea-900"
            >
              See the math
              <ChevronDown className={cn("h-3.5 w-3.5 transition", why && "rotate-180")} strokeWidth={3} aria-hidden="true" />
            </button>
            <RopeInToggle on={checked} disabled={checkDisabled} label={name} onToggle={onToggleCheck} className="h-9" />
          </div>
        </div>
      </div>
      {why ? (
        <div id={whyId} className="mt-2.5 space-y-2 rounded-[20px] bg-shell-mid p-3">
          <Breakdown r={r} />
          {r.vsAbove ? <p className="pt-1 text-[13px] leading-snug text-stone-800">{r.vsAbove}</p> : null}
        </div>
      ) : null}
    </article>
  );
}

const MISSING_LABEL: Record<Factor, string> = {
  price: "Price",
  bike: "Bike time",
  bedrooms: "Bedrooms",
  bathrooms: "Bathrooms",
  amenities: "Parking or laundry"
};

function Breakdown({ r }: { r: RankedPlace<Listing> }) {
  const shown = FACTORS.filter((f) => r.contributions[f] > 0 || r.factors[f].known !== "yes");
  return (
    <dl className="space-y-1.5">
      {shown.map((f) => {
        const s = r.factors[f];
        const mid = (s.lo + s.hi) / 2;
        return (
          <div key={f} className="grid grid-cols-[96px_minmax(0,1fr)] items-center gap-x-3 gap-y-0.5 sm:grid-cols-[140px_120px_minmax(0,1fr)]">
            <dt className="text-[13px] font-semibold text-tar">{FACTOR_LABELS[f].replace(" to campus", "")}</dt>
            <dd className="order-3 col-span-2 text-[13px] text-stone-800 sm:order-none sm:col-span-1">
              <span
                className={cn("relative block h-2 overflow-hidden rounded-full", s.known === "yes" ? "bg-shell-deep" : "border border-dashed border-stone-500")}
                role="img"
                aria-label={s.known === "no" ? "unknown" : `${Math.round(mid * 10)} out of 10`}
              >
                {s.known !== "no" ? <span className="absolute inset-y-0 left-0 rounded-full bg-sea-700" style={{ width: `${s.lo * 100}%` }} /> : null}
              </span>
            </dd>
            <dd className="text-[13px] text-stone-800 sm:order-none">{r.facts[f] ?? "Unknown"}</dd>
          </div>
        );
      })}
    </dl>
  );
}

function HeldSection({
  title,
  items,
  action,
  photos,
  dim = false,
  onOpen
}: {
  title: string;
  items: HeldPlace<Listing>[];
  action?: { label: string; onClick: (id: string) => void };
  photos: boolean;
  dim?: boolean;
  onOpen: (id: string) => void;
}) {
  return (
    <section className={cn("rounded-[26px] p-2", dim ? "bg-shell-mid" : "border-2 border-dashed border-sunset-600/70")}>
      <h3 className="px-2 py-2 font-display text-[16px] text-tar">{title}</h3>
      <ul className="space-y-1.5">
        {items.map((h) => {
          const name = streetHeadline(h.place.address, h.place.title);
          return (
            <li key={h.place.id} className="flex items-center gap-3 rounded-[20px] bg-shell p-2 pr-3">
              <div className={cn("h-14 w-20 shrink-0 overflow-hidden rounded-[14px] bg-shell-deep", dim && "opacity-60 grayscale")}>
                {h.place.lat === null ? (
                  <EmptyLot size="sm" />
                ) : (
                  <StreetPhoto listingId={h.place.id} lat={h.place.lat} lng={h.place.lng} label={name} size="card" enabled={photos} attribution="tiny" className="h-full w-full" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <button type="button" onClick={() => onOpen(h.place.id)} className={cn("text-left font-display text-[15px] leading-tight hover:underline", dim ? "text-stone-800" : "text-tar")}>
                  {name}
                </button>
                <p className="mt-0.5 text-[13px] text-stone-800">{h.reasons.join(" · ")}</p>
              </div>
              {action ? (
                <Button size="sm" variant="secondary" onClick={() => action.onClick(h.place.id)} aria-label={`${action.label} ${name}`}>
                  {action.label}
                </Button>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Priorities

/** Shorter names for the rows; the full names stay as the controls' accessible labels. */
const FACTOR_SHORT: Record<Factor, string> = {
  price: "Price",
  bike: "Bike time to campus",
  bedrooms: "Bedrooms",
  bathrooms: "Bathrooms",
  amenities: "Parking & laundry"
};

function PrioritiesPanel({ priorities: p, onChange, onReset }: { priorities: Priorities; onChange: (p: Priorities) => void; onReset: () => void }) {
  const id = useId();
  const [maxText, setMaxText] = useState(centsToDollarsInput(p.maxRentPerPersonCents));
  const [lastMax, setLastMax] = useState(p.maxRentPerPersonCents);
  if (p.maxRentPerPersonCents !== lastMax) {
    setLastMax(p.maxRentPerPersonCents);
    setMaxText(centsToDollarsInput(p.maxRentPerPersonCents));
  }
  const field = "mt-1.5 h-11 w-full rounded-full border border-divider bg-shell-light px-4 text-sm text-tar";

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 px-1">
        <div>
          <h2 className="font-display text-[22px] text-tar">What matters to you</h2>
          <p className="mt-0.5 text-[13px] text-stone-700">Just yours, on this device.</p>
        </div>
        <button type="button" onClick={onReset} className="mt-1 text-[13px] font-semibold text-sea-900 underline underline-offset-4">
          Reset
        </button>
      </div>

      <Group id={`${id}-must`} title="Must-haves">
        <div className="space-y-4">
          <div>
            <label htmlFor={`${id}-max`} className="text-[13px] font-semibold text-tar">
              Max rent per person
            </label>
            <div className="relative">
              <span aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 mt-[3px] -translate-y-1/2 text-sm text-stone-700">
                $
              </span>
              <input
                id={`${id}-max`}
                inputMode="numeric"
                placeholder="No max"
                value={maxText}
                onChange={(e) => {
                  setMaxText(e.target.value);
                  const cents = e.target.value.trim() === "" ? null : parseDollars(e.target.value);
                  if (cents === null || Number.isFinite(cents)) {
                    setLastMax(cents);
                    onChange({ ...p, maxRentPerPersonCents: cents });
                  }
                }}
                className={cn(field, "pl-8")}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label htmlFor={`${id}-beds`} className="text-[13px] font-semibold text-tar">
                Bedrooms
              </label>
              <select
                id={`${id}-beds`}
                value={p.minBeds ?? ""}
                onChange={(e) => onChange({ ...p, minBeds: e.target.value ? Number(e.target.value) : null })}
                className={cn(field, "px-3")}
              >
                <option value="">Any</option>
                {[1, 2, 3, 4, 5, 6].map((n) => (
                  <option key={n} value={n}>
                    {n}+
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor={`${id}-move`} className="text-[13px] font-semibold text-tar">
                Move in by
              </label>
              <input
                id={`${id}-move`}
                type="date"
                value={p.moveInBy ?? ""}
                onChange={(e) => onChange({ ...p, moveInBy: e.target.value || null })}
                className={cn(field, "px-3")}
              />
            </div>
          </div>
          <div>
            <p className="text-[13px] font-semibold text-tar">Also need</p>
            <div className="mt-1.5 flex flex-wrap gap-2">
              <Chip label="Laundry" title="In unit or on site" checked={p.needsLaundry} onChange={(v) => onChange({ ...p, needsLaundry: v })} />
              <Chip label="Off-street parking" checked={p.needsParking} onChange={(v) => onChange({ ...p, needsParking: v })} />
            </div>
          </div>
        </div>
      </Group>

      <Group id={`${id}-weights`} title="How much it counts">
        <div className="-my-1 divide-y divide-divider">
          {FACTORS.map((f) => (
            <LevelControl
              key={f}
              label={FACTOR_LABELS[f]}
              short={FACTOR_SHORT[f]}
              value={p.weights[f]}
              onChange={(v) => onChange({ ...p, weights: { ...p.weights, [f]: v } })}
            />
          ))}
        </div>
      </Group>
    </div>
  );
}

function Group({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="rounded-[24px] bg-shell p-4">
      <h3 id={id} className="mb-3 font-display text-[16px] text-tar">
        {title}
      </h3>
      {children}
    </section>
  );
}

/** An on/off pill for a must-have. */
function Chip({ label, title, checked, onChange }: { label: string; title?: string; checked: boolean; onChange: (v: boolean) => void }) {
  const Icon = checked ? Check : Plus;
  return (
    <label
      title={title}
      className={cn(
        "relative inline-flex h-10 cursor-pointer items-center gap-1.5 rounded-full border px-3.5 text-[13px] transition has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-focus",
        checked ? "border-sea-800 bg-sea-800 font-semibold text-shell" : "border-divider bg-shell-light text-tar hover:bg-shell-mid"
      )}
    >
      <input type="checkbox" className="sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <Icon className="h-3.5 w-3.5" strokeWidth={3} aria-hidden="true" />
      {label}
    </label>
  );
}

/**
 * How much one factor counts: a leaning board for "Don't care", then three
 * boards that stand taller. Real radio buttons underneath, so arrow keys move
 * between levels.
 */
function LevelControl({ label, short, value, onChange }: { label: string; short: string; value: Level; onChange: (v: Level) => void }) {
  const name = useId();
  return (
    <div role="radiogroup" aria-label={label} className="flex items-center gap-3 py-2.5">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold leading-tight text-tar">{short}</p>
        <p className={cn("mt-0.5 text-xs", value === 0 ? "text-stone-700" : "font-semibold text-sunset-700")}>{LEVEL_LABELS[value]}</p>
      </div>
      <div className="flex items-end">
        {LEVEL_LABELS.map((l, i) => {
          const on = i === 0 ? value === 0 : value >= i;
          return (
            <span key={l} className={cn("relative flex h-10 items-end justify-center pb-2", i === 0 ? "mr-1 w-8" : "w-6")} title={l}>
              <input
                type="radio"
                name={name}
                aria-label={l}
                checked={value === i}
                onChange={() => onChange(i as Level)}
                className="peer absolute inset-0 z-10 cursor-pointer appearance-none rounded-full opacity-0"
              />
              {i === 0 ? (
                <span
                  aria-hidden="true"
                  className={cn(
                    "block h-[18px] w-[10px] origin-bottom rotate-[16deg] rounded-t-full rounded-b-[2px] transition-colors",
                    on ? "bg-stone-600" : "bg-stone-300 peer-hover:bg-stone-400"
                  )}
                />
              ) : (
                <span
                  aria-hidden="true"
                  className={cn(
                    "block w-[10px] rounded-t-full rounded-b-[2px] transition-colors",
                    i === 1 ? "h-3.5" : i === 2 ? "h-5" : "h-[26px]",
                    on ? (i === 1 ? "bg-sunset-400" : i === 2 ? "bg-sunset-500" : "bg-sunset-600") : "ring-[1.5px] ring-inset ring-stone-400 peer-hover:ring-stone-600"
                  )}
                />
              )}
              <span aria-hidden="true" className="pointer-events-none absolute inset-0.5 rounded-full peer-focus-visible:ring-2 peer-focus-visible:ring-focus" />
            </span>
          );
        })}
      </div>
    </div>
  );
}

function PrioritiesSheet({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      onClose={(e) => {
        e.stopPropagation();
        onClose();
      }}
      aria-label="Your priorities"
      className="mb-0 mt-auto max-h-[88dvh] w-full max-w-none overflow-y-auto rounded-t-[32px] bg-shell-deep p-0 text-tar backdrop:bg-tar/40 lg:hidden"
    >
      <div className="px-5 pt-5">{children}</div>
      <div className="sticky bottom-0 bg-shell-deep px-5 pb-6 pt-3">
        <Button className="w-full" onClick={() => ref.current?.close()}>
          Show ranking
        </Button>
      </div>
    </dialog>
  );
}
