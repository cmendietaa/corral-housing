"use client";

import { ExternalLink, MapPinOff, Pencil, Star } from "lucide-react";
import { formatRent, meetsBudget, rentPerPerson } from "@/lib/compare";
import { formatCount, formatLeasePhrase } from "@/lib/format";
import { isClosedStatus, type Board, type Listing, type ListingPatch } from "@/lib/listing";
import { cn } from "@/lib/utils";
import { NextAction } from "./next-action";
import { StatusSelect } from "./status";

type Props = {
  listing: Listing;
  board: Board;
  selected: boolean;
  onSelect: () => void;
  onPatch: (patch: ListingPatch) => Promise<void>;
  onEdit: () => void;
};

export function ListingCard({ listing, board, selected, onSelect, onPatch, onEdit }: Props) {
  const closed = isClosedStatus(listing.status);
  const perPerson = rentPerPerson(listing.rentCents, board.members.length || null);

  return (
    <article
      id={`listing-${listing.id}`}
      aria-current={selected ? "true" : undefined}
      onClick={(e) => {
        // Selecting a card shouldn't steal clicks from its controls.
        if ((e.target as HTMLElement).closest("button, a, select, input, label, form")) return;
        onSelect();
      }}
      className={cn(
        "group relative rounded-lg border bg-surface p-4 shadow-soft transition sm:p-5",
        selected ? "border-coral ring-2 ring-coral/30" : "border-line hover:border-ocean/30",
        closed && "bg-surface/70"
      )}
    >
      <div className="flex items-start gap-3">
        <div className={cn("min-w-0 flex-1", closed && "opacity-60")}>
          <h3 className="text-base font-semibold leading-snug text-ink">
            <button
              type="button"
              onClick={onSelect}
              className="text-left hover:text-ocean focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            >
              {listing.title}
            </button>
          </h3>
          <p className="mt-0.5 flex items-center gap-1 text-sm text-muted">
            {listing.address ?? "No address yet"}
            {listing.lat === null ? (
              <span className="inline-flex items-center gap-0.5 text-xs" title="No map pin yet">
                <MapPinOff className="h-3.5 w-3.5" aria-hidden="true" />
                <span className="sr-only">No map pin yet</span>
              </span>
            ) : null}
          </p>
        </div>
        <button
          type="button"
          aria-pressed={listing.starred}
          aria-label={listing.starred ? `Remove ${listing.title} from shortlist` : `Add ${listing.title} to shortlist`}
          onClick={() => void onPatch({ starred: !listing.starred })}
          className={cn(
            "-mr-1 -mt-1 rounded-full p-2 transition focus-visible:outline-2 focus-visible:outline-focus",
            listing.starred ? "text-coral hover:bg-coral-soft" : "text-muted/60 hover:bg-sand hover:text-coral"
          )}
        >
          <Star className="h-5 w-5" fill={listing.starred ? "currentColor" : "none"} aria-hidden="true" />
        </button>
      </div>

      <div className={cn("mt-3 flex flex-wrap items-baseline gap-x-4 gap-y-1", closed && "opacity-60")}>
        <p className="text-2xl font-bold tabular-nums tracking-tight text-ink">
          {listing.rentCents === null ? (
            <span className="text-lg font-semibold text-muted">Rent unknown</span>
          ) : (
            <>
              {formatRent(listing.rentCents)}
              <span className="text-sm font-medium text-muted">/mo</span>
            </>
          )}
        </p>
        {perPerson !== null ? (
          <p className="text-sm tabular-nums text-muted">
            {formatRent(perPerson)} each
            {board.budgetPerPersonCents !== null ? (
              <BudgetNote within={meetsBudget(perPerson, board.budgetPerPersonCents)} />
            ) : null}
          </p>
        ) : null}
      </div>

      <p className={cn("mt-1 text-sm text-muted", closed && "opacity-60")}>
        {formatCount(listing.beds, "bed")}, {formatCount(listing.baths, "bath")}
        <span className="mx-1.5 text-line" aria-hidden="true">|</span>
        {formatLeasePhrase(listing.leaseStart, listing.leaseEnd)}
      </p>

      <div className="mt-4">
        <NextAction listing={listing} members={board.members} onSave={onPatch} />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <StatusSelect
          value={listing.status}
          label={`Status for ${listing.title}`}
          onChange={(status) => void onPatch({ status })}
        />
        <div className="ml-auto flex items-center gap-1">
          <a
            href={listing.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-semibold text-ocean transition hover:bg-ocean-soft focus-visible:outline-2 focus-visible:outline-focus"
          >
            Open listing
            <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="sr-only">(opens in a new tab)</span>
          </a>
          <button
            type="button"
            onClick={onEdit}
            className="inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-semibold text-muted transition hover:bg-sand hover:text-ink focus-visible:outline-2 focus-visible:outline-focus"
          >
            <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
            Edit
          </button>
        </div>
      </div>
    </article>
  );
}

function BudgetNote({ within }: { within: boolean }) {
  return (
    <span
      className={cn(
        "ml-2 rounded-full px-2 py-0.5 text-xs font-semibold",
        within ? "bg-st-applied-bg text-st-applied" : "bg-coral-soft text-danger"
      )}
    >
      {within ? "Within budget" : "Over budget"}
    </span>
  );
}
