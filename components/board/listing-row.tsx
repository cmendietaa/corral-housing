"use client";

import { forwardRef } from "react";
import { Check, Star } from "lucide-react";
import { areaLabel, streetHeadline } from "@/lib/address";
import { formatRent, rentPerPerson } from "@/lib/compare";
import { formatBedsBaths } from "@/lib/format";
import { isClosedStatus, type Board, type Listing, type ListingPatch } from "@/lib/listing";
import { cn } from "@/lib/utils";
import { ownerDue } from "./next-action";
import { StatusChip } from "./status";
import { StreetPhoto } from "./street-photo";

type Props = {
  listing: Listing;
  board: Board;
  selected: boolean;
  checked: boolean;
  /** True when three places are already checked and this one isn't. */
  checkDisabled: boolean;
  onToggleCheck: () => void;
  /** Select on desktop, open the place sheet on phones (the board decides). */
  onActivate: () => void;
  onPatch: (patch: ListingPatch) => Promise<void>;
  photos: boolean;
};

/** The star toggle, in sunset-600 when on and stone-600 when off (both clear 3:1 on Shell). */
export function StarButton({
  starred,
  label,
  onToggle,
  className
}: {
  starred: boolean;
  label: string;
  onToggle: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={starred}
      aria-label={starred ? `Remove ${label} from shortlist` : `Add ${label} to shortlist`}
      onClick={onToggle}
      className={cn("flex items-center justify-center rounded-full transition hover:bg-shell-deep", className)}
    >
      <Star
        className={cn("h-4 w-4", starred ? "text-sunset-600" : "text-stone-600")}
        strokeWidth={2.75}
        fill={starred ? "currentColor" : "none"}
        aria-hidden="true"
      />
    </button>
  );
}

/**
 * One place as a row. Desktop grid: check and star | Street View board | name,
 * meta, status | rent. Phones: Street View board | name and status | rent and star.
 */
export const ListingRow = forwardRef<HTMLElement, Props>(function ListingRow(
  { listing, board, selected, checked, checkDisabled, onToggleCheck, onActivate, onPatch, photos },
  ref
) {
  const closed = isClosedStatus(listing.status);
  const headline = streetHeadline(listing.address, listing.title);
  const area = areaLabel(listing.address);
  const perPerson = rentPerPerson(listing.rentCents, board.members.length || null);
  const od = ownerDue(listing, board.members);
  const meta = [headline !== listing.title ? listing.title : null, formatBedsBaths(listing.beds, listing.baths) || null]
    .filter(Boolean)
    .join(" · ");
  const toggleStar = () => void onPatch({ starred: !listing.starred });

  return (
    <article
      ref={ref}
      id={`listing-${listing.id}`}
      aria-current={selected ? "true" : undefined}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest("button, a, select, input, label")) return;
        onActivate();
      }}
      className={cn(
        "grid cursor-pointer scroll-mt-28 items-center gap-3 rounded-[24px] p-2.5 transition-colors",
        "grid-cols-[44px_minmax(0,1fr)_auto] lg:grid-cols-[24px_52px_minmax(0,1fr)_auto] lg:pr-3.5",
        selected ? "bg-sea-100" : "hover:bg-shell-mid",
        closed && "opacity-55"
      )}
    >
      {/* Col 1 (desktop): compare check and star */}
      <div className="hidden flex-col items-center gap-2 lg:flex">
        <button
          type="button"
          role="checkbox"
          aria-checked={checked}
          aria-label={`Compare ${headline}`}
          disabled={checkDisabled}
          title={checkDisabled ? "You can compare up to three places" : undefined}
          onClick={onToggleCheck}
          className={cn(
            "flex h-[22px] w-[22px] items-center justify-center rounded-full transition disabled:cursor-not-allowed disabled:opacity-40",
            checked ? "bg-sea-700 text-white" : "ring-[1.5px] ring-inset ring-stone-600 hover:bg-shell-deep"
          )}
        >
          {checked ? <Check className="h-3.5 w-3.5" strokeWidth={3} aria-hidden="true" /> : null}
        </button>
        <StarButton starred={listing.starred} label={headline} onToggle={toggleStar} className="h-6 w-6" />
      </div>

      {/* Col 2: Street View board. Washed-out places skip the photo. */}
      {closed ? (
        <div className="h-16 w-11 lg:h-[76px] lg:w-[52px]" aria-hidden="true" />
      ) : (
        <StreetPhoto
          lat={listing.lat}
          lng={listing.lng}
          label={headline}
          size="row"
          enabled={photos}
          attribution="tiny"
          className="h-16 w-11 rounded-full lg:h-[76px] lg:w-[52px]"
        />
      )}

      {/* Col 3: name, meta, status */}
      <div className="min-w-0">
        <h3 className="flex flex-wrap items-baseline gap-x-2">
          <button
            type="button"
            onClick={onActivate}
            className="min-w-0 text-left font-display text-[15px] leading-tight text-tar lg:text-lg"
          >
            {headline}
          </button>
          {area ? <span className="label hidden text-stone-700 lg:inline">{area}</span> : null}
        </h3>
        {meta ? <p className="mt-0.5 hidden truncate text-[13px] text-stone-700 lg:block">{meta}</p> : null}
        <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1">
          <StatusChip status={listing.status} />
          {listing.lat === null && !closed ? (
            <button
              type="button"
              onClick={onActivate}
              className="hidden rounded-full px-2.5 py-[2px] text-[11px] font-semibold text-sunset-700 ring-[1.5px] ring-inset ring-sunset-500 hover:bg-sunset-100 lg:inline-flex"
            >
              Drop pin
            </button>
          ) : null}
          {od ? (
            <span className={cn("label hidden lg:inline", od.overdue ? "text-danger" : "text-stone-700")}>{od.text}</span>
          ) : null}
        </div>
      </div>

      {/* Col 4: rent (and the star, on phones) */}
      <div className="flex flex-col items-end text-right">
        {listing.rentCents === null ? (
          <>
            <p className="font-display text-[15px] text-stone-700 lg:text-[21px]">Unknown</p>
            <p className="hidden text-xs text-stone-700 lg:block">Rent unknown</p>
          </>
        ) : (
          <>
            <p className="font-display text-[15px] text-tar lg:text-[21px]">{formatRent(listing.rentCents)}</p>
            {perPerson !== null ? (
              <p className="hidden text-xs text-stone-700 lg:block">{formatRent(perPerson)} / person</p>
            ) : null}
          </>
        )}
        <StarButton
          starred={listing.starred}
          label={headline}
          onToggle={toggleStar}
          className="-mr-1.5 mt-0.5 h-8 w-8 lg:hidden"
        />
      </div>
    </article>
  );
});
