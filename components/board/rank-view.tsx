"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, SlidersHorizontal } from "lucide-react";
import { streetHeadline } from "@/lib/address";
import { formatRent } from "@/lib/compare";
import { centsToDollarsInput, parseDollars } from "@/lib/format";
import { isClosedStatus, type Board, type Listing } from "@/lib/listing";
import {
  FACTORS,
  FACTOR_LABELS,
  LEVEL_LABELS,
  defaultPriorities,
  formatScore,
  headline,
  rankPlaces,
  type Factor,
  type HeldPlace,
  type Level,
  type Priorities,
  type RankedPlace,
  type Requirement
} from "@/lib/rank";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { StreetPhoto, FenceFallback } from "./street-photo";

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
export function RankView({ listings, board, photos, checked, checkDisabled, onToggleCheck, onCompare, onOpen, onEdit }: Props) {
  const { priorities, update, reset } = usePriorities(board);
  const people = board.members.length || null;
  const ranking = useMemo(() => rankPlaces(listings, priorities, people), [listings, priorities, people]);
  const [editing, setEditing] = useState(false);
  const openCount = ranking.ranked.length + ranking.missingInfo.length + ranking.doesntMeet.length;
  const top = ranking.ranked.slice(0, 3).map((r) => r.place.id);
  const closedCount = listings.filter((l) => isClosedStatus(l.status)).length;

  const panel = <PrioritiesPanel priorities={priorities} onChange={update} onReset={reset} />;

  return (
    <div className="pb-28 lg:grid lg:grid-cols-[340px_minmax(0,1fr)] lg:gap-6 lg:pb-10">
      {/* Desktop: priorities beside the list */}
      <aside aria-label="Your priorities" className="hidden lg:block">
        <div className="sticky top-4 rounded-[32px] bg-shell-deep p-5">{panel}</div>
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

      <section aria-label="Ranked places" className="min-w-0 max-w-[820px] space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="label text-stone-700">Best fit for you · {ranking.ranked.length}</h2>
            {openCount > 0 ? (
              <p className="mt-1 text-sm text-stone-800">
                {ranking.ranked.length} of {openCount} open {openCount === 1 ? "place fits" : "places fit"} your must-haves
                {ranking.ranked.length < openCount ? "; the rest are below." : "."}
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
              <li key={r.place.id}>
                <RankCard
                  r={r}
                  photos={photos}
                  checked={checked.includes(r.place.id)}
                  checkDisabled={checkDisabled(r.place.id)}
                  onToggleCheck={() => onToggleCheck(r.place.id)}
                  onOpen={() => onOpen(r.place.id)}
                />
              </li>
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
  const notes: string[] = [];
  if (openCount < 2) notes.push("Add a few places to rank them.");
  else if (!ranking.ranked.length && ranking.tightest)
    notes.push(`No place meets all your requirements. The ${REQUIREMENT_LABELS[ranking.tightest]} rules out the most; loosen it?`);
  if (ranking.allDontCare) notes.push("Everything is set to Don't care, so places are ranked by price.");
  if (ranking.noPins) notes.push("None of these places has a pin, so bike time can't count yet. Drop pins on the map.");
  if (ranking.closeCall && ranking.ranked.length >= 2)
    notes.push(`Close call: #1 changes depending on how much ${FACTOR_LABELS[ranking.closeCall].toLowerCase()} matters.`);
  if (!notes.length) return null;
  return (
    <ul className="space-y-2">
      {notes.map((n) => (
        <li key={n} className="rounded-[18px] bg-glass-200 px-4 py-2.5 text-sm text-glass-900">
          {n}
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
  const score = formatScore(r);

  return (
    <article aria-label={`#${r.rank} ${name}, ${score} out of 10`} className="rounded-[26px] bg-shell p-3 shadow-sm sm:p-4">
      <div className="flex items-start gap-3">
        <span aria-hidden="true" className="w-6 shrink-0 pt-1 text-center font-display text-xl text-tar">
          {r.rank}
        </span>
        <div className="h-16 w-16 shrink-0 overflow-hidden rounded-[18px] bg-shell-deep sm:h-[72px] sm:w-24">
          {r.place.lat === null ? (
            <FenceFallback />
          ) : (
            <StreetPhoto listingId={r.place.id} lat={r.place.lat} lng={r.place.lng} label={name} size="row" enabled={photos} attribution="tiny" className="h-full w-full" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-2">
            <button type="button" onClick={onOpen} className="min-w-0 flex-1 pt-0.5 text-left font-display text-[17px] leading-tight text-tar hover:underline">
              {name}
            </button>
            <div className="shrink-0 text-right">
              <p>
                <span className="font-display text-[22px] leading-none text-tar">{score}</span>
                <span className="text-[13px] text-stone-700">/10</span>
              </p>
              <span aria-hidden="true" className="mt-1.5 block h-1.5 w-16 overflow-hidden rounded-full bg-shell-deep">
                <span className="block h-full rounded-full bg-sea-700" style={{ width: `${r.score}%` }} />
              </span>
            </div>
          </div>
          {line.length ? (
            <p className="mt-1.5 space-y-0.5 text-[13px] leading-snug text-stone-800">
              {line.map((x) => (
                <span key={x.factor} className="block">
                  <span className={x.sign === "+" ? "text-sea-900" : "text-danger"} aria-hidden="true">
                    {x.sign === "+" ? "+ " : "− "}
                  </span>
                  <span className="sr-only">{x.sign === "+" ? "Plus: " : "Minus: "}</span>
                  {x.text}
                </span>
              ))}
            </p>
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
          <div className="mt-2 flex items-center gap-4">
            <button
              type="button"
              aria-expanded={why}
              aria-controls={whyId}
              onClick={() => setWhy((w) => !w)}
              className="inline-flex h-9 items-center gap-1 text-[13px] font-semibold text-sea-900"
            >
              Why?
              <ChevronDown className={cn("h-3.5 w-3.5 transition", why && "rotate-180")} strokeWidth={3} aria-hidden="true" />
            </button>
            <label className={cn("inline-flex h-9 items-center gap-2 text-[13px] text-stone-800", checkDisabled ? "opacity-50" : "cursor-pointer")}>
              <input type="checkbox" className="peer sr-only" checked={checked} disabled={checkDisabled} onChange={onToggleCheck} aria-label={`Compare ${name}`} />
              <span
                aria-hidden="true"
                className="flex h-5 w-5 items-center justify-center rounded-md border-[1.5px] border-stone-600 peer-checked:border-sea-800 peer-checked:bg-sea-800 peer-focus-visible:ring-2 peer-focus-visible:ring-focus"
              >
                {checked ? <Check className="h-3.5 w-3.5 text-shell" strokeWidth={3.5} /> : null}
              </span>
              Compare
            </label>
          </div>
        </div>
      </div>
      {why ? (
        <div id={whyId} className="mt-2 space-y-2 rounded-[20px] bg-shell-mid p-3 sm:ml-9">
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
    <section className="rounded-[26px] bg-shell-mid p-2">
      <h3 className="label px-2 py-2 text-stone-700">{title}</h3>
      <ul className="space-y-1.5">
        {items.map((h) => {
          const name = streetHeadline(h.place.address, h.place.title);
          return (
            <li key={h.place.id} className="flex items-center gap-3 rounded-[18px] bg-shell px-3 py-2.5">
              <div className={cn("h-11 w-11 shrink-0 overflow-hidden rounded-[14px] bg-shell-deep", dim && "opacity-60 grayscale")}>
                {h.place.lat === null ? (
                  <FenceFallback />
                ) : (
                  <StreetPhoto listingId={h.place.id} lat={h.place.lat} lng={h.place.lng} label={name} size="row" enabled={photos} attribution="tiny" className="h-full w-full" />
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

function PrioritiesPanel({ priorities: p, onChange, onReset }: { priorities: Priorities; onChange: (p: Priorities) => void; onReset: () => void }) {
  const id = useId();
  const [maxText, setMaxText] = useState(centsToDollarsInput(p.maxRentPerPersonCents));
  const [lastMax, setLastMax] = useState(p.maxRentPerPersonCents);
  if (p.maxRentPerPersonCents !== lastMax) {
    setLastMax(p.maxRentPerPersonCents);
    setMaxText(centsToDollarsInput(p.maxRentPerPersonCents));
  }
  const field = "mt-1 h-11 w-full rounded-full border border-divider bg-shell-light px-4 text-sm text-tar";

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-baseline justify-between">
          <h2 className="font-display text-xl text-tar">Your priorities</h2>
          <button type="button" onClick={onReset} className="text-[13px] font-semibold text-sea-900 underline underline-offset-4">
            Reset
          </button>
        </div>
        <p className="mt-1 text-[13px] text-stone-700">Saved on this device. Your roommates set their own.</p>
      </div>

      <fieldset className="space-y-3">
        <legend className="label mb-2 text-stone-700">Must have</legend>
        <div>
          <label htmlFor={`${id}-max`} className="text-[13px] font-semibold text-tar">
            Max rent per person
          </label>
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
            className={field}
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
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
        <Toggle label="Laundry in unit or on site" checked={p.needsLaundry} onChange={(v) => onChange({ ...p, needsLaundry: v })} />
        <Toggle label="Off-street parking" checked={p.needsParking} onChange={(v) => onChange({ ...p, needsParking: v })} />
      </fieldset>

      <fieldset>
        <legend className="label mb-3 text-stone-700">What matters</legend>
        <div className="space-y-3.5">
          {FACTORS.map((f) => (
            <LevelControl key={f} label={FACTOR_LABELS[f]} value={p.weights[f]} onChange={(v) => onChange({ ...p, weights: { ...p.weights, [f]: v } })} />
          ))}
        </div>
      </fieldset>
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm text-tar">
      <input type="checkbox" className="peer sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span
        aria-hidden="true"
        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-[1.5px] border-stone-600 peer-checked:border-sea-800 peer-checked:bg-sea-800 peer-focus-visible:ring-2 peer-focus-visible:ring-focus"
      >
        {checked ? <Check className="h-3.5 w-3.5 text-shell" strokeWidth={3.5} /> : null}
      </span>
      {label}
    </label>
  );
}

function LevelControl({ label, value, onChange }: { label: string; value: Level; onChange: (v: Level) => void }) {
  return (
    <div role="radiogroup" aria-label={label}>
      <p className="mb-1 text-[13px] font-semibold text-tar">{label}</p>
      <div className="grid grid-cols-4 gap-0.5 rounded-full border border-divider bg-shell-light p-0.5">
        {LEVEL_LABELS.map((l, i) => (
          <button
            key={l}
            type="button"
            role="radio"
            aria-checked={value === i}
            onClick={() => onChange(i as Level)}
            className={cn(
              "h-9 rounded-full px-1 text-xs transition",
              value === i ? "bg-sea-800 font-semibold text-shell" : "text-tar hover:bg-shell-mid"
            )}
          >
            {l}
          </button>
        ))}
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
      className="mb-0 mt-auto max-h-[88dvh] w-full max-w-none overflow-y-auto rounded-t-[32px] bg-shell p-0 text-tar backdrop:bg-tar/40 lg:hidden"
    >
      <div className="px-5 pt-5">{children}</div>
      <div className="sticky bottom-0 bg-shell px-5 pb-6 pt-3">
        <Button className="w-full" onClick={() => ref.current?.close()}>
          Show ranking
        </Button>
      </div>
    </dialog>
  );
}
