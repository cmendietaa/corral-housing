"use client";

import { ArrowLeft, ArrowUpRight, X } from "lucide-react";
import { Band } from "@/components/brand/band";
import { Button } from "@/components/ui/button";
import { streetHeadline } from "@/lib/address";
import { buildComparison, formatRent, type CompareCell } from "@/lib/compare";
import { formatLease } from "@/lib/format";
import { LAUNDRY_LABELS, PARKING_LABELS, type Board, type Listing } from "@/lib/listing";
import { cn } from "@/lib/utils";
import { ownerDue } from "./next-action";
import { StreetPhoto } from "./street-photo";

/** The tray that appears once a place is checked. Anchored to the map's right on desktop. */
export function CompareTray({
  count,
  onCompare,
  onClear,
  className
}: {
  count: number;
  onCompare: () => void;
  onClear: () => void;
  className?: string;
}) {
  if (count === 0) return null;
  return (
    <div
      role="status"
      className={cn("flex items-center gap-3 rounded-full bg-sea-800 py-2 pl-5 pr-2 text-sea-100 shadow-lg", className)}
    >
      <span className="text-[15px]">{count === 1 ? "1 checked · pick one more" : `${count} places checked`}</span>
      {count >= 2 ? (
        <Button size="md" onClick={onCompare}>
          Compare
        </Button>
      ) : null}
      <button
        type="button"
        onClick={onClear}
        aria-label="Clear checked places"
        className="flex h-9 w-9 items-center justify-center rounded-full text-sea-100 hover:bg-sea-700"
      >
        <X className="h-4 w-4" strokeWidth={2.75} aria-hidden="true" />
      </button>
    </div>
  );
}

function Cell({ cell, compact = false }: { cell: CompareCell; compact?: boolean }) {
  const text = compact && cell.short ? cell.short : cell.text;
  if (cell.best) {
    return <span className="inline-block rounded-full bg-sea-200 px-3 py-0.5 font-bold text-sea-900">{text}</span>;
  }
  if (cell.unknown) {
    return <span className="inline-block rounded-full bg-shell-mid px-3 py-0.5 italic text-stone-700">{text}</span>;
  }
  return <span className="text-tar">{text}</span>;
}

/**
 * Two or three places side by side. Rows always come in the same order, the
 * best value per row is a sea pill, and unknowns stay explicitly Unknown.
 */
export function CompareView({
  places,
  board,
  photos,
  onBack
}: {
  places: Listing[];
  board: Board;
  photos: boolean;
  onBack: () => void;
}) {
  const rows = buildComparison(places, {
    people: board.members.length || null,
    budgetPerPersonCents: board.budgetPerPersonCents,
    formatLease,
    parkingLabel: (p) => PARKING_LABELS[p],
    laundryLabel: (l) => LAUNDRY_LABELS[l],
    ownerDue: (p) => ownerDue(p, board.members)?.text.replace(" · ", ", ") ?? null
  });
  const n = places.length;
  const budget = board.budgetPerPersonCents !== null ? `Budget ${formatRent(board.budgetPerPersonCents)} / person` : null;

  return (
    <div className="flex min-h-screen flex-col">
      <Band variant="thin" />
      <main className="mx-auto w-full max-w-[1100px] flex-1 px-4 pb-16 pt-6 lg:px-8 lg:pt-8">
        {/* Header */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <button
            type="button"
            onClick={onBack}
            aria-label="Back to board"
            className="flex h-11 w-11 items-center justify-center rounded-full border border-divider bg-shell-light lg:hidden"
          >
            <ArrowLeft className="h-5 w-5" strokeWidth={2.75} aria-hidden="true" />
          </button>
          <h1 className="font-display text-2xl text-tar lg:text-[32px]">
            <span className="lg:hidden">Comparing {n}</span>
            <span className="hidden lg:inline">Comparing {n} places</span>
          </h1>
          <div className="ml-auto flex items-center gap-5">
            {budget ? <span className="label text-stone-700">{budget}</span> : null}
            <Button variant="secondary" onClick={onBack} className="hidden lg:inline-flex">
              Back to board
            </Button>
          </div>
        </div>

        {/* Desktop: label column plus one column per place */}
        <div
          className="mt-8 hidden gap-x-3.5 lg:grid"
          style={{ gridTemplateColumns: `150px repeat(${n}, minmax(0, 1fr))` }}
        >
          <div />
          {places.map((p) => {
            const name = streetHeadline(p.address, p.title);
            return (
              <div key={p.id} className="overflow-hidden rounded-t-[30px] bg-shell-deep">
                <StreetPhoto
                  listingId={p.id}
                  lat={p.lat}
                  lng={p.lng}
                  label={name}
                  size="compare"
                  enabled={photos}
                  hint
                  className="h-40 w-full"
                />
                <div className="px-5 pb-4 pt-4">
                  <h2 className="font-display text-xl leading-tight text-tar">{name}</h2>
                  <p className="mt-1 text-sm text-stone-700">
                    {p.title !== name ? `${p.title} · ` : ""}
                    <a href={p.url} target="_blank" rel="noopener noreferrer" className="font-semibold text-sea-700 underline underline-offset-4">
                      Open listing
                      <ArrowUpRight className="ml-0.5 inline h-3.5 w-3.5" strokeWidth={2.75} aria-hidden="true" />
                      <span className="sr-only">(opens in a new tab)</span>
                    </a>
                  </p>
                </div>
              </div>
            );
          })}
          {rows.map((row, ri) => {
            const last = ri === rows.length - 1;
            return (
              <div key={row.key} className="contents">
                <div className="label flex items-center border-t border-divider py-4 text-stone-700">{row.label}</div>
                {row.cells.map((cell, ci) => (
                  <div
                    key={ci}
                    className={cn(
                      "flex items-center border-t border-divider bg-shell-deep px-5 py-4 text-[15px]",
                      last && "rounded-b-[28px]"
                    )}
                  >
                    <Cell cell={cell} />
                  </div>
                ))}
              </div>
            );
          })}
        </div>

        {/* Phones: photo boards up top, then each row's label above its values */}
        <div className="mt-5 lg:hidden">
          <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}>
            {places.map((p) => {
              const name = streetHeadline(p.address, p.title);
              return (
                <div key={p.id} className="min-w-0">
                  <StreetPhoto
                    listingId={p.id}
                    lat={p.lat}
                    lng={p.lng}
                    label={name}
                    size="row"
                    enabled={photos}
                    attribution="tiny"
                    className="h-[92px] w-full rounded-[22px]"
                  />
                  <p className="mt-1.5 font-display text-[13px] leading-tight text-tar">{name}</p>
                </div>
              );
            })}
          </div>
          <dl className="mt-4 divide-y divide-divider">
            {rows.map((row) => (
              <div key={row.key} className="py-3">
                <dt className="label text-stone-700">{row.label}</dt>
                <dd className="mt-1.5 grid gap-2 text-[13px]" style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}>
                  {row.cells.map((cell, ci) => (
                    <span key={ci} className="min-w-0 break-words">
                      <Cell cell={cell} compact />
                    </span>
                  ))}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </main>
    </div>
  );
}
