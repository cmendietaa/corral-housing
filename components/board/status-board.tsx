"use client";

import { useRef, useState } from "react";
import { streetHeadline } from "@/lib/address";
import { formatRent } from "@/lib/compare";
import { formatBeds } from "@/lib/format";
import { STATUS_LABELS, starredFirst, type Board, type Listing, type ListingPatch, type ListingStatus } from "@/lib/listing";
import { cn } from "@/lib/utils";
import { RopeTagButton } from "@/components/brand/controls";
import { EmptyLot } from "@/components/brand/motifs";
import { StreetPhoto } from "./street-photo";
import { NextAction } from "./next-action";
import { StarButton } from "./listing-row";
import { StatusMenu } from "./status";
import { STATUS_STYLES } from "./status-style";

const COLUMNS: ListingStatus[] = ["considering", "contacted", "tour_scheduled", "applied"];
const WASHED: ListingStatus[] = ["passed", "unavailable"];

/** The usual next stage, for the one-tap "Move to …" button. Applied has none. */
const NEXT: Partial<Record<ListingStatus, ListingStatus>> = {
  considering: "contacted",
  contacted: "tour_scheduled",
  tour_scheduled: "applied"
};

/** Each stage is a tall fence board washed in its own color. */
const WASH: Record<string, string> = {
  considering: "bg-stone-300/40",
  contacted: "bg-sunset-200/60",
  tour_scheduled: "bg-glass-200/60",
  applied: "bg-glass-300/45"
};

const SHORT: Record<string, string> = {
  considering: "Considering",
  contacted: "Contacted",
  tour_scheduled: "Tour",
  applied: "Applied",
  washed: "Washed out"
};

type Props = {
  listings: Listing[];
  board: Board;
  photos: boolean;
  onPatch: (id: string, patch: ListingPatch) => Promise<boolean | void>;
  /** Open a place (desktop: back to the map with it selected; phones: the place sheet). */
  onOpen: (id: string) => void;
};

/**
 * The Status tab: where each place stands, as a row of tall fence boards. A
 * card moves to the next stage with one tap ("Move to Tour scheduled"), or
 * anywhere with the "Other" menu. Passed and Unavailable wash out to the shore
 * on the right (display copy only; the statuses keep their PRD names).
 */
export function StatusBoard({ listings, board, photos, onPatch, onOpen }: Props) {
  const columnRefs = useRef(new Map<ListingStatus, HTMLElement>());
  const [shown, setShown] = useState<ListingStatus | "washed">("considering");
  const byStatus = (s: ListingStatus) => starredFirst(listings.filter((l) => l.status === s));
  const washed = WASHED.flatMap(byStatus);

  return (
    <div className="pb-24 lg:pb-10">
      {/* Phones: the stages as a little fence; tap one to jump to it. */}
      <nav aria-label="Stages" className="flex h-[92px] items-end gap-2 lg:hidden">
        {[...COLUMNS, "washed" as const].map((s) => {
          const count = s === "washed" ? washed.length : byStatus(s).length;
          const current = shown === s;
          return (
            <button
              key={s}
              type="button"
              aria-current={current ? "true" : undefined}
              aria-label={`${s === "washed" ? "Washed out" : STATUS_LABELS[s]}, ${count} ${count === 1 ? "place" : "places"}`}
              onClick={() => {
                setShown(s);
                columnRefs.current.get(s === "washed" ? "passed" : s)?.scrollIntoView({ behavior: "smooth", inline: "start", block: "nearest" });
              }}
              className={cn(
                "flex flex-1 flex-col items-center gap-0.5 rounded-t-[28px] rounded-b-[10px] pt-2.5 transition-[height]",
                s === "washed" ? "bg-sea-100 text-sea-800" : STATUS_STYLES[s].chip,
                current ? "h-[88px] ring-2 ring-tar ring-offset-2 ring-offset-shell" : "h-[68px]"
              )}
            >
              <span aria-hidden="true" className="font-display text-lg leading-none">
                {count}
              </span>
              <span aria-hidden="true" className="px-0.5 text-center text-[10px] font-bold leading-tight">
                {SHORT[s]}
              </span>
            </button>
          );
        })}
      </nav>

      <div
        className={cn(
          "no-scrollbar mt-4 flex snap-x snap-mandatory gap-3.5 overflow-x-auto pb-2 max-lg:-mx-4 max-lg:px-4 lg:mt-0 lg:grid lg:snap-none lg:overflow-visible",
          "lg:grid-cols-[repeat(4,minmax(0,1fr))_190px]"
        )}
      >
        {COLUMNS.map((s) => {
          const cards = byStatus(s);
          return (
            <section
              key={s}
              ref={(el) => {
                if (el) columnRefs.current.set(s, el);
              }}
              aria-labelledby={`col-${s}`}
              className={cn("w-[300px] shrink-0 snap-start rounded-t-[120px] rounded-b-[24px] px-3 pb-3 pt-7 lg:min-h-[560px] lg:w-auto", WASH[s])}
            >
              <div className="mb-3 flex flex-col items-center gap-1">
                <MiniFence count={cards.length} className={STATUS_STYLES[s].dot} />
                <h2 id={`col-${s}`} className="font-display text-[21px] leading-tight text-tar">
                  {STATUS_LABELS[s]}
                </h2>
                <p className="text-[13px] text-stone-700">
                  {cards.length} {cards.length === 1 ? "place" : "places"}
                </p>
              </div>
              <ul className="space-y-3">
                {cards.map((l) => (
                  <li key={l.id}>
                    <StatusCard listing={l} board={board} photos={photos} onPatch={(p) => onPatch(l.id, p)} onOpen={() => onOpen(l.id)} />
                  </li>
                ))}
              </ul>
            </section>
          );
        })}

        {/* Washed out: the shore, where places that didn't work out lean like old boards. */}
        <section
          ref={(el) => {
            if (el) columnRefs.current.set("passed", el);
          }}
          aria-labelledby="col-washed"
          className="flex w-[220px] shrink-0 snap-start flex-col lg:w-auto lg:self-end"
        >
          <span
            aria-hidden="true"
            className="block h-4"
            style={{ background: "radial-gradient(circle at 50% 100%, var(--color-sea-100) 13px, transparent 14px) -2px 0 / 28px 16px repeat-x" }}
          />
          <div className="flex-1 space-y-3.5 rounded-b-[24px] bg-sea-100 px-4 pb-5 pt-2">
            <h2 id="col-washed" className="font-display text-[19px] text-sea-800">
              Washed out
            </h2>
            {washed.length === 0 ? <p className="text-[13px] text-sea-800/80">Nothing here.</p> : null}
            <ul className="space-y-3">
              {washed.map((l, i) => (
                <li key={l.id}>
                  <button type="button" onClick={() => onOpen(l.id)} className="flex w-full items-end gap-2.5 rounded-[14px] text-left">
                    <span
                      aria-hidden="true"
                      className="block h-10 w-3 shrink-0 origin-bottom rounded-t-full rounded-b-[2px] bg-stone-400"
                      style={{ transform: `rotate(${i % 2 ? -10 : 14}deg)` }}
                    />
                    <span className="min-w-0">
                      <span className="block font-display text-[15px] leading-tight text-tar">{streetHeadline(l.address, l.title)}</span>
                      <span className="mt-0.5 block text-xs text-stone-800">
                        {STATUS_LABELS[l.status]}
                        {l.rentCents !== null ? ` · ${formatRent(l.rentCents)}` : ""}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </div>
    </div>
  );
}

/** One board per place: the column's count as a tiny fence. */
function MiniFence({ count, className }: { count: number; className: string }) {
  const heights = [18, 22, 15, 20, 17];
  if (count === 0) return <span aria-hidden="true" className="block h-[22px] w-[7px] rounded-t-full rounded-b-[1px] border border-dashed border-stone-500" />;
  return (
    <span aria-hidden="true" className="flex h-[22px] items-end gap-[3px]">
      {Array.from({ length: Math.min(count, 8) }, (_, i) => (
        <span key={i} className={cn("block w-[7px] rounded-t-full rounded-b-[1px]", className)} style={{ height: heights[i % heights.length] }} />
      ))}
    </span>
  );
}

function StatusCard({
  listing,
  board,
  photos,
  onPatch,
  onOpen
}: {
  listing: Listing;
  board: Board;
  photos: boolean;
  onPatch: (patch: ListingPatch) => Promise<boolean | void>;
  onOpen: () => void;
}) {
  const headline = streetHeadline(listing.address, listing.title);
  const meta = [listing.title !== headline ? listing.title : null, listing.beds !== null ? formatBeds(listing.beds) : null, listing.baths !== null ? `${listing.baths} ba` : null]
    .filter(Boolean)
    .join(" · ");
  const next = NEXT[listing.status];
  return (
    <article className="space-y-2.5 rounded-[20px] bg-shell-light p-3 shadow-sm">
      <div className="flex gap-2.5">
        <div className="h-[68px] w-[52px] shrink-0 overflow-hidden rounded-t-[26px] rounded-b-[10px]">
          {listing.lat === null ? (
            <EmptyLot size="sm" />
          ) : (
            <StreetPhoto listingId={listing.id} lat={listing.lat} lng={listing.lng} label={headline} size="row" enabled={photos} attribution="tiny" className="h-full w-full" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-1">
            <button type="button" onClick={onOpen} className="min-w-0 flex-1 text-left font-display text-base leading-tight text-tar">
              {headline}
            </button>
            <StarButton
              starred={listing.starred}
              label={headline}
              onToggle={() => void onPatch({ starred: !listing.starred })}
              className="-mr-1 -mt-1 h-7 w-7 shrink-0"
            />
          </div>
          {meta ? <p className="mt-0.5 text-[13px] leading-snug text-stone-700">{meta}</p> : null}
          <p className={cn("mt-0.5 font-display text-base", listing.rentCents === null ? "text-stone-700" : "text-tar")}>
            {listing.rentCents === null ? "Rent not listed" : formatRent(listing.rentCents)}
          </p>
        </div>
      </div>
      {listing.nextAction ? <NextAction listing={listing} members={board.members} onSave={onPatch} variant="crew" /> : null}
      <div className="flex flex-wrap items-center gap-2">
        {next ? (
          <RopeTagButton onClick={() => void onPatch({ status: next })} className={cn(STATUS_STYLES[next].chip, "hover:brightness-95")}>
            Move to {STATUS_LABELS[next]}
          </RopeTagButton>
        ) : null}
        <StatusMenu
          value={listing.status}
          variant="move"
          moveText={next ? "Other" : "Move"}
          label={`Move ${headline} to another status`}
          onChange={(status) => void onPatch({ status })}
        />
      </div>
    </article>
  );
}
