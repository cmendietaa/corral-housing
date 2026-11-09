"use client";

import { forwardRef } from "react";
import { ExternalLink, MapPin, Pencil, Star } from "lucide-react";
import { streetHeadline } from "@/lib/address";
import { formatRent, meetsBudget, rentPerPerson } from "@/lib/compare";
import { formatCount, formatLeasePhrase } from "@/lib/format";
import { isClosedStatus, type Board, type Listing, type ListingPatch } from "@/lib/listing";
import { cn } from "@/lib/utils";
import { NextAction } from "./next-action";
import { STATUS_STYLES, StatusSelect } from "./status";

type Props = {
  listing: Listing;
  board: Board;
  selected: boolean;
  onSelect: () => void;
  onPatch: (patch: ListingPatch) => Promise<void>;
  onEdit: () => void;
};

/**
 * One place as a ledger row: street-first headline, rent aligned on the right,
 * a status-colored edge, and the next step on its own line.
 */
export const ListingRow = forwardRef<HTMLElement, Props>(function ListingRow(
  { listing, board, selected, onSelect, onPatch, onEdit },
  ref
) {
  const closed = isClosedStatus(listing.status);
  const perPerson = rentPerPerson(listing.rentCents, board.members.length || null);
  const headline = streetHeadline(listing.address, listing.title);
  const showTitle = headline !== listing.title;

  return (
    <article
      ref={ref}
      id={`listing-${listing.id}`}
      aria-current={selected ? "true" : undefined}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest("button, a, select, input, label, form, textarea")) return;
        onSelect();
      }}
      className={cn(
        "relative scroll-mt-24 py-4 pl-5 pr-4 transition-colors sm:pr-5",
        "before:absolute before:inset-y-3 before:left-0 before:w-1 before:rounded-full",
        STATUS_STYLES[listing.status].edge,
        selected ? "bg-coral-soft/60" : "hover:bg-sand/70"
      )}
    >
      {selected ? (
        <span aria-hidden="true" className="absolute inset-y-0 right-0 w-0.5 bg-coral" />
      ) : null}

      <div className="flex items-start gap-3">
        <div className={cn("min-w-0 flex-1", closed && "opacity-55")}>
          <h3 className="font-display text-lg font-bold leading-tight text-ink">
            <button
              type="button"
              onClick={onSelect}
              className="text-left decoration-coral decoration-2 underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            >
              {headline}
            </button>
          </h3>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-sm text-muted">
            {showTitle ? <span>{listing.title}</span> : null}
            {listing.lat === null ? (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-muted">
                <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                Not on the map yet
              </span>
            ) : null}
          </p>
        </div>

        <div className={cn("shrink-0 text-right", closed && "opacity-55")}>
          {listing.rentCents === null ? (
            <p className="text-base font-semibold text-muted">Rent unknown</p>
          ) : (
            <p className="font-display text-xl font-extrabold tabular-nums text-ink">
              {formatRent(listing.rentCents)}
              <span className="text-xs font-medium text-muted">/mo</span>
            </p>
          )}
          {perPerson !== null ? (
            <p className="text-xs tabular-nums text-muted">
              {formatRent(perPerson)} each
              {board.budgetPerPersonCents !== null ? (
                meetsBudget(perPerson, board.budgetPerPersonCents) ? (
                  <span className="ml-1.5 font-semibold text-st-applied">within budget</span>
                ) : (
                  <span className="ml-1.5 font-semibold text-danger">over budget</span>
                )
              ) : null}
            </p>
          ) : null}
        </div>

        <button
          type="button"
          aria-pressed={listing.starred}
          aria-label={listing.starred ? `Remove ${headline} from shortlist` : `Add ${headline} to shortlist`}
          onClick={() => void onPatch({ starred: !listing.starred })}
          className={cn(
            "-mr-2 -mt-1.5 rounded-full p-2 transition focus-visible:outline-2 focus-visible:outline-focus",
            listing.starred ? "text-coral hover:bg-coral-soft" : "text-muted/50 hover:bg-sand hover:text-coral"
          )}
        >
          <Star className="h-5 w-5" fill={listing.starred ? "currentColor" : "none"} aria-hidden="true" />
        </button>
      </div>

      <p className={cn("mt-1.5 text-sm text-muted", closed && "opacity-55")}>
        {formatCount(listing.beds, "bed")}, {formatCount(listing.baths, "bath")}
        <span className="mx-2 text-line" aria-hidden="true">|</span>
        {formatLeasePhrase(listing.leaseStart, listing.leaseEnd)}
      </p>

      <div className="mt-2.5">
        <NextAction listing={listing} members={board.members} onSave={onPatch} />
      </div>

      <div className="mt-3 flex items-center gap-1">
        <StatusSelect
          value={listing.status}
          label={`Status for ${headline}`}
          onChange={(status) => void onPatch({ status })}
        />
        <a
          href={listing.url}
          target="_blank"
          rel="noopener noreferrer"
          className="ml-auto inline-flex h-8 items-center gap-1.5 rounded-full px-2.5 text-xs font-semibold text-ocean transition hover:bg-ocean-soft focus-visible:outline-2 focus-visible:outline-focus"
        >
          <span className="sm:hidden">Listing</span>
          <span className="hidden sm:inline">Open listing</span>
          <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
          <span className="sr-only">(opens in a new tab)</span>
        </a>
        <button
          type="button"
          onClick={onEdit}
          aria-label={`Edit ${headline}`}
          className="inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-semibold text-muted transition hover:bg-sand hover:text-ink focus-visible:outline-2 focus-visible:outline-focus"
        >
          <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
          <span className="hidden sm:inline">Edit</span>
        </button>
      </div>
    </article>
  );
});
