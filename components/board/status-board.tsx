"use client";

import { useRef } from "react";
import { streetHeadline } from "@/lib/address";
import { formatRent } from "@/lib/compare";
import { STATUS_LABELS, type Board, type Listing, type ListingPatch, type ListingStatus } from "@/lib/listing";
import { cn } from "@/lib/utils";
import { FenceFallback, StreetPhoto } from "./street-photo";
import { NextAction } from "./next-action";
import { StarButton } from "./listing-row";
import { StatusMenu } from "./status";
import { STATUS_STYLES } from "./status-style";

const COLUMNS: ListingStatus[] = ["considering", "contacted", "tour_scheduled", "applied"];
const WASHED: ListingStatus[] = ["passed", "unavailable"];

type Props = {
  listings: Listing[];
  board: Board;
  photos: boolean;
  onPatch: (id: string, patch: ListingPatch) => Promise<void>;
  /** Open a place (desktop: back to the map with it selected; phones: the place sheet). */
  onOpen: (id: string) => void;
};

/**
 * The Status tab: where each place stands. Cards move between columns with
 * the "Move" menu. Passed and Unavailable fold into the narrow "Washed out"
 * shelf (display copy only; the statuses keep their PRD names).
 */
export function StatusBoard({ listings, board, photos, onPatch, onOpen }: Props) {
  const columnRefs = useRef(new Map<ListingStatus, HTMLElement>());
  const byStatus = (s: ListingStatus) => listings.filter((l) => l.status === s);

  return (
    <div className="pb-24 lg:pb-10">
      {/* Phones: status chips with counts that jump to a column */}
      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 lg:hidden">
        {[...COLUMNS, "washed" as const].map((s) => {
          const count = s === "washed" ? WASHED.flatMap(byStatus).length : byStatus(s).length;
          return (
            <button
              key={s}
              type="button"
              onClick={() =>
                columnRefs.current
                  .get(s === "washed" ? "passed" : s)
                  ?.scrollIntoView({ behavior: "smooth", inline: "start", block: "nearest" })
              }
              className="flex h-11 shrink-0 items-center gap-2 rounded-full bg-shell-deep px-4 text-[13px] font-semibold text-tar"
            >
              <span
                aria-hidden="true"
                className={cn("h-2.5 w-2.5 rounded-full", s === "washed" ? "bg-st-closed-dot" : STATUS_STYLES[s].dot)}
              />
              {s === "washed" ? "Washed out" : STATUS_LABELS[s]} · {count}
            </button>
          );
        })}
      </div>

      <div
        className={cn(
          "no-scrollbar mt-4 flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2 max-lg:-mx-4 max-lg:px-4 lg:mt-0 lg:grid lg:snap-none lg:overflow-visible",
          "lg:grid-cols-[repeat(4,minmax(0,1fr))_150px]"
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
              className="w-[300px] shrink-0 snap-start rounded-[32px] bg-shell-deep p-4 lg:min-h-[520px] lg:w-auto"
            >
              <h2 id={`col-${s}`} className="mb-3 flex items-center gap-2.5 px-1.5">
                <span aria-hidden="true" className={cn("h-3 w-3 rounded-full", STATUS_STYLES[s].dot)} />
                <span className="label flex-1 text-tar">{STATUS_LABELS[s]}</span>
                <span className="font-display text-lg text-tar" aria-label={`${cards.length} places`}>
                  {cards.length}
                </span>
              </h2>
              <ul className="space-y-3">
                {cards.length === 0 ? (
                  <li className="flex h-28 items-center justify-center rounded-[26px] border-[1.5px] border-dashed border-stone-500 text-sm text-stone-700">
                    Nothing here yet
                  </li>
                ) : (
                  cards.map((l) => (
                    <li key={l.id}>
                      <StatusCard listing={l} board={board} photos={photos} onPatch={(p) => onPatch(l.id, p)} onOpen={() => onOpen(l.id)} />
                    </li>
                  ))
                )}
              </ul>
            </section>
          );
        })}

        <section
          ref={(el) => {
            if (el) columnRefs.current.set("passed", el);
          }}
          aria-labelledby="col-washed"
          className="w-[220px] shrink-0 snap-start rounded-[32px] bg-shell-mid p-4 lg:min-h-[520px] lg:w-auto"
        >
          <h2 id="col-washed" className="label mb-3 px-1 text-stone-700">
            Washed out
          </h2>
          {WASHED.map((s) => {
            const cards = byStatus(s);
            return (
              <div key={s} className="mb-4">
                <p className="mb-2 px-1 text-[13px] font-semibold text-stone-700">
                  {STATUS_LABELS[s]} · {cards.length}
                </p>
                <ul className="space-y-2">
                  {cards.map((l) => (
                    <li key={l.id}>
                      <button
                        type="button"
                        onClick={() => onOpen(l.id)}
                        className="w-full rounded-[20px] bg-shell p-3 text-left opacity-70 transition hover:opacity-100"
                      >
                        <span className="block font-display text-[15px] leading-tight text-tar">
                          {streetHeadline(l.address, l.title)}
                        </span>
                        <span className="mt-1 block text-xs text-stone-700">
                          {l.rentCents === null ? "Rent unknown" : formatRent(l.rentCents)}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </section>
      </div>
    </div>
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
  onPatch: (patch: ListingPatch) => Promise<void>;
  onOpen: () => void;
}) {
  const headline = streetHeadline(listing.address, listing.title);
  const meta = [listing.title !== headline ? listing.title : null, listing.beds !== null ? `${listing.beds} bd` : null, listing.baths !== null ? `${listing.baths} ba` : null]
    .filter(Boolean)
    .join(" · ");
  return (
    <article className="overflow-hidden rounded-[26px] bg-shell shadow-sm">
      {listing.lat === null ? (
        <div className="relative h-[110px] w-full bg-shell-deep">
          <FenceFallback text="No pin yet" />
          <StarOverlay listing={listing} headline={headline} onPatch={onPatch} />
        </div>
      ) : (
        <StreetPhoto
          lat={listing.lat}
          lng={listing.lng}
          label={headline}
          size="kanban"
          enabled={photos}
          className="h-[110px] w-full"
        >
          <StarOverlay listing={listing} headline={headline} onPatch={onPatch} />
        </StreetPhoto>
      )}
      <div className="space-y-2.5 p-4">
        <div className="flex items-baseline justify-between gap-2">
          <button type="button" onClick={onOpen} className="min-w-0 text-left font-display text-base leading-tight text-tar">
            {headline}
          </button>
          <span className={cn("shrink-0 font-display text-base", listing.rentCents === null ? "text-stone-700" : "text-tar")}>
            {listing.rentCents === null ? "Unknown" : formatRent(listing.rentCents)}
          </span>
        </div>
        {meta ? <p className="text-[13px] text-stone-700">{meta}</p> : null}
        {listing.nextAction ? <NextAction listing={listing} members={board.members} onSave={onPatch} variant="crew" /> : null}
        <StatusMenu
          value={listing.status}
          variant="move"
          label={`Move ${headline} to another status`}
          onChange={(status) => void onPatch({ status })}
        />
      </div>
    </article>
  );
}

function StarOverlay({
  listing,
  headline,
  onPatch
}: {
  listing: Listing;
  headline: string;
  onPatch: (patch: ListingPatch) => Promise<void>;
}) {
  return (
    <StarButton
      starred={listing.starred}
      label={headline}
      onToggle={() => void onPatch({ starred: !listing.starred })}
      className="absolute left-3 top-3 h-[30px] w-[30px] bg-shell shadow-sm hover:bg-shell-mid"
    />
  );
}
