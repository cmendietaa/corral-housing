"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ArrowLeft, ArrowUpRight, Bike, Footprints, Pencil, Plus, X } from "lucide-react";
import { areaLabel, streetHeadline } from "@/lib/address";
import { formatRent, rentPerPerson } from "@/lib/compare";
import { formatBeds, formatBedsBaths } from "@/lib/format";
import { commuteToCampus } from "@/lib/commute";
import type { Board, Listing, ListingPatch } from "@/lib/listing";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { NextAction, ownerDue } from "./next-action";
import { StarButton } from "./listing-row";
import { StatusChip, StatusMenu } from "./status";
import { StreetPhoto } from "./street-photo";
import { TourPhotoStrip } from "./tour-photos";

type Shared = {
  listing: Listing;
  board: Board;
  photos: boolean;
  /** Resolves false when the change couldn't be saved (the board says why). */
  onPatch: (patch: ListingPatch) => Promise<boolean | void>;
  onEdit: () => void;
};

function OpenListing({ url, className }: { url: string; className?: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={cn("inline-flex items-center gap-0.5 text-sm font-semibold text-sea-700 underline underline-offset-4", className)}
    >
      Open listing
      <ArrowUpRight className="h-4 w-4" strokeWidth={2.75} aria-hidden="true" />
      <span className="sr-only">(opens in a new tab)</span>
    </a>
  );
}

const NOTES_MAX = 2000;

/** The group's notes on a place: shown in full, added or edited in place. */
export function PlaceNotes({
  notes,
  label,
  onSave,
  className
}: {
  notes: string | null;
  label: string;
  onSave: (notes: string | null) => Promise<boolean | void>;
  className?: string;
}) {
  const id = useId();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(notes ?? "");
  const [saving, setSaving] = useState(false);

  function start() {
    setDraft(notes ?? "");
    setEditing(true);
  }

  async function save() {
    const next = draft.trim() === "" ? null : draft.trim();
    setSaving(true);
    try {
      // If it didn't save, stay open with the draft so they can try again.
      if (next !== notes && (await onSave(next)) === false) return;
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  if (editing) {
    return (
      <div className={className}>
        <label htmlFor={`${id}-notes`} className="label mb-1.5 block text-stone-700">
          Notes
        </label>
        <textarea
          id={`${id}-notes`}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.preventDefault();
              e.stopPropagation();
              setEditing(false);
            }
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void save();
          }}
          autoFocus
          rows={4}
          maxLength={NOTES_MAX}
          placeholder="Anything the group should know: vibe, noise, landlord, deposit…"
          className="w-full rounded-[18px] border border-divider bg-shell-light px-3.5 py-2.5 text-sm text-tar placeholder:text-stone-600"
        />
        <div className="mt-2 flex items-center gap-2">
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving}
            className="h-9 rounded-full bg-sea-700 px-4 text-sm font-semibold text-shell hover:bg-sea-800 disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save notes"}
          </button>
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="h-9 rounded-full px-3 text-sm font-semibold text-stone-700 hover:bg-shell-mid hover:text-tar"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  if (!notes) {
    return (
      <button
        type="button"
        onClick={start}
        className={cn("inline-flex items-center gap-1.5 text-[13px] font-semibold text-stone-700 hover:text-tar", className)}
      >
        <Plus className="h-3.5 w-3.5" strokeWidth={2.75} aria-hidden="true" />
        Add a note
      </button>
    );
  }

  return (
    <section aria-label={`Notes on ${label}`} className={cn("rounded-[20px] bg-shell-mid px-4 py-3", className)}>
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <h3 className="label text-stone-700">Notes</h3>
        <button
          type="button"
          onClick={start}
          aria-label={`Edit notes on ${label}`}
          className="text-xs font-semibold text-sea-700 underline underline-offset-2 hover:text-sea-900"
        >
          Edit
        </button>
      </div>
      <p className="whitespace-pre-line break-words text-sm text-tar">{notes}</p>
    </section>
  );
}

/** Desktop: the selected place, floating over the map's bottom-left corner. */
export function PlaceCard({ listing, board, photos, onPatch, onEdit, onClose }: Shared & { onClose: () => void }) {
  const headline = streetHeadline(listing.address, listing.title);
  const perPerson = rentPerPerson(listing.rentCents, board.members.length || null);
  const commute = commuteToCampus(listing.lat, listing.lng);
  const nickname = headline !== listing.title ? listing.title : null;
  const size = formatBedsBaths(listing.beds, listing.baths) || null;

  return (
    <section
      aria-label={`Selected place: ${headline}`}
      className="w-[330px] overflow-hidden rounded-[30px] bg-shell shadow-lg"
    >
      <StreetPhoto
        listingId={listing.id}
        lat={listing.lat}
        lng={listing.lng}
        label={headline}
        size="card"
        enabled={photos}
        attribution="long"
        hint
        className="h-[230px] w-full"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute left-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-shell text-tar shadow-sm hover:bg-shell-mid"
        >
          <X className="h-4 w-4" strokeWidth={2.75} aria-hidden="true" />
        </button>
      </StreetPhoto>
      <div className="space-y-3 p-5">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="min-w-0 font-display text-xl leading-tight text-tar">{headline}</h2>
          <p className="shrink-0 font-display text-xl text-tar">
            {listing.rentCents === null ? <span className="text-stone-700">Unknown</span> : formatRent(listing.rentCents)}
          </p>
        </div>
        {nickname ? <p className="-mt-2 text-sm text-stone-700">{nickname}</p> : null}
        {/* The facts as small tags instead of one long line. */}
        {size || perPerson !== null || commute ? (
          <ul className="flex flex-wrap gap-1.5 text-[13px] text-tar">
            {size ? <li className="rounded-full bg-shell-mid px-2.5 py-1 font-semibold">{size}</li> : null}
            {perPerson !== null ? <li className="rounded-full bg-shell-mid px-2.5 py-1 font-semibold">{formatRent(perPerson)} each</li> : null}
            {commute ? (
              <li className="inline-flex items-center gap-2 rounded-full bg-glass-200 px-2.5 py-1 font-semibold text-glass-800">
                <span className="inline-flex items-center gap-1">
                  <Bike className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden="true" />
                  <span className="sr-only">Bike:</span>
                  {commute.bikeMin} min
                </span>
                <span className="inline-flex items-center gap-1">
                  <Footprints className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden="true" />
                  <span className="sr-only">Walk:</span>
                  {commute.walkMin} min
                </span>
                <span className="font-normal">to campus</span>
              </li>
            ) : null}
          </ul>
        ) : null}
        <div className="flex items-center justify-between gap-2">
          <StatusMenu value={listing.status} label={`Status for ${headline}`} onChange={(status) => void onPatch({ status })} />
          {listing.url ? <OpenListing url={listing.url} /> : null}
        </div>
        <NextAction listing={listing} members={board.members} onSave={onPatch} />
        <PlaceNotes notes={listing.notes} label={headline} onSave={(notes) => onPatch({ notes })} />
        <TourPhotoStrip listing={listing} label={headline} streetEnabled={photos} />
        <button
          type="button"
          onClick={onEdit}
          className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-stone-700 hover:text-tar"
        >
          <Pencil className="h-3.5 w-3.5" strokeWidth={2.75} aria-hidden="true" />
          Edit details
        </button>
      </div>
    </section>
  );
}

/** Phone map: the selected place as a small card above the List / Map switch. */
export function MapMiniCard({
  listing,
  board,
  photos,
  onOpen
}: {
  listing: Listing;
  board: Board;
  photos: boolean;
  onOpen: () => void;
}) {
  const headline = streetHeadline(listing.address, listing.title);
  const od = ownerDue(listing, board.members);
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`Open ${headline}`}
      className="flex w-full items-center gap-3 rounded-[26px] bg-shell p-2.5 pr-4 text-left shadow-lg"
    >
      <StreetPhoto
        listingId={listing.id}
        lat={listing.lat}
        lng={listing.lng}
        label={headline}
        size="row"
        enabled={photos}
        attribution="tiny"
        className="h-[84px] w-[112px] rounded-[16px]"
      />
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-2">
          <span className="truncate font-display text-base text-tar">{headline}</span>
          <span className="shrink-0 font-display text-base text-tar">
            {listing.rentCents === null ? "Unknown" : formatRent(listing.rentCents)}
          </span>
        </span>
        {formatBedsBaths(listing.beds, listing.baths) ? (
          <span className="mt-0.5 block text-xs text-stone-700">
            {[headline !== listing.title ? listing.title : null, formatBedsBaths(listing.beds, listing.baths)]
              .filter(Boolean)
              .join(" · ")}
          </span>
        ) : null}
        <span className="mt-1.5 flex flex-wrap items-center gap-2">
          <StatusChip status={listing.status} />
        </span>
        {listing.nextAction ? (
          <span className="label mt-1.5 block text-stone-700">Next{od ? ` · ${od.text}` : ""}</span>
        ) : null}
      </span>
    </button>
  );
}

/** Phones: the place sheet. A full-bleed Street View with a Shell sheet sliding up over it. */
export function PlaceSheet({
  listing,
  board,
  photos,
  onPatch,
  onEdit,
  onClose,
  onDropPin,
  checked,
  checkDisabled,
  onToggleCheck
}: Shared & {
  onClose: () => void;
  /** Close the sheet and go to the map to place this pin. */
  onDropPin: () => void;
  checked: boolean;
  checkDisabled: boolean;
  onToggleCheck: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const headline = streetHeadline(listing.address, listing.title);
  const area = areaLabel(listing.address);
  const perPerson = rentPerPerson(listing.rentCents, board.members.length || null);

  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
  }, []);

  const stat = (big: string, small: string | null, unknown = false) => (
    <div className="min-w-0 rounded-[20px] bg-shell-mid px-3 py-2.5">
      <p className={cn("truncate font-display text-lg leading-tight", unknown ? "text-stone-700" : "text-tar")}>{big}</p>
      {small ? <p className="truncate text-[11px] text-stone-700">{small}</p> : null}
    </div>
  );

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-label={headline}
      className="m-0 h-dvh max-h-none w-full max-w-none bg-sea-800 p-0 text-tar backdrop:bg-transparent"
    >
      <div className="relative h-full overflow-y-auto">
        <StreetPhoto
          listingId={listing.id}
          lat={listing.lat}
          lng={listing.lng}
          label={headline}
          size="sheet"
          enabled={photos}
          attribution="long"
          hint
          className="sticky top-0 h-[360px] w-full bg-sea-800 [&_span.text-xs]:text-sea-100"
        >
          <button
            type="button"
            onClick={() => ref.current?.close()}
            aria-label="Back to the list"
            className="absolute left-4 top-4 flex h-11 w-11 items-center justify-center rounded-full bg-shell text-tar shadow-md"
          >
            <ArrowLeft className="h-5 w-5" strokeWidth={2.75} aria-hidden="true" />
          </button>
        </StreetPhoto>

        <div className="relative -mt-10 min-h-[calc(100dvh-320px)] rounded-t-[36px] bg-shell px-5 pb-10 pt-3">
          <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-stone-400" aria-hidden="true" />
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="label text-stone-700">{[area, listing.title !== headline ? listing.title : null].filter(Boolean).join(" · ")}</p>
              <h2 className="mt-1 font-display text-[26px] leading-tight text-tar">{headline}</h2>
            </div>
            <StarButton
              starred={listing.starred}
              label={headline}
              onToggle={() => void onPatch({ starred: !listing.starred })}
              className="h-11 w-11 shrink-0 [&_svg]:h-6 [&_svg]:w-6"
            />
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2">
            {listing.rentCents === null
              ? stat("Unknown", "Rent unknown", true)
              : stat(formatRent(listing.rentCents), perPerson !== null ? `${formatRent(perPerson)} / person` : null)}
            {listing.beds === null
              ? stat("Beds?", listing.baths === null ? null : `${listing.baths} ba`, true)
              : stat(formatBeds(listing.beds), listing.baths === null ? "Baths unknown" : `${listing.baths} ba`)}
            {leaseTile(listing, stat)}
          </div>

          <div className="mt-4 flex items-center justify-between gap-2">
            <StatusMenu value={listing.status} label={`Status for ${headline}`} onChange={(status) => void onPatch({ status })} />
            {listing.url ? <OpenListing url={listing.url} /> : null}
          </div>

          <NextAction listing={listing} members={board.members} onSave={onPatch} variant="crew" className="mt-4" />

          <PlaceNotes notes={listing.notes} label={headline} onSave={(notes) => onPatch({ notes })} className="mt-4" />

          <TourPhotoStrip listing={listing} label={headline} streetEnabled={photos} className="mt-4" />

          {listing.lat === null ? (
            <Button type="button" variant="secondary" className="mt-3 w-full" onClick={onDropPin}>
              Drop a pin on the map
            </Button>
          ) : null}

          <Button
            type="button"
            variant="sea"
            size="lg"
            className="mt-6 w-full"
            disabled={!checked && checkDisabled}
            onClick={onToggleCheck}
          >
            {checked ? "Remove from compare" : checkDisabled ? "Compare is full (3)" : "Add to compare"}
          </Button>
          <button
            type="button"
            onClick={onEdit}
            className="mx-auto mt-4 flex items-center gap-1.5 text-sm font-semibold text-stone-700"
          >
            <Pencil className="h-3.5 w-3.5" strokeWidth={2.75} aria-hidden="true" />
            Edit details
          </button>
        </div>
      </div>
    </dialog>
  );
}

const leaseDate = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

function leaseTile(listing: Listing, stat: (big: string, small: string | null, unknown?: boolean) => React.ReactNode) {
  const fmt = (iso: string) => leaseDate.format(new Date(`${iso}T00:00:00Z`));
  if (!listing.leaseStart && !listing.leaseEnd) return stat("Lease?", "Dates unknown", true);
  return stat(
    listing.leaseStart ? fmt(listing.leaseStart) : "Start?",
    listing.leaseEnd ? `to ${fmt(listing.leaseEnd)}` : "End unknown"
  );
}
