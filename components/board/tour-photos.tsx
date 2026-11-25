"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { Check, ChevronLeft, ChevronRight, Eye, EyeOff, ImagePlus, Loader2, Trash2, X } from "lucide-react";
import type { Cover } from "@/lib/cover";
import type { Listing } from "@/lib/listing";
import { streetViewSrc } from "@/lib/streetview";
import { MAX_PHOTOS_PER_PLACE, type Photo } from "@/lib/stores/types";
import { cn } from "@/lib/utils";

/**
 * A place's photos: up to 8 the group adds (tour photos, pictures saved from
 * the listing) plus Street View. The group picks which one leads (the cover)
 * and can hide Street View. The board owns the state and provides it here, so
 * every photo frame (row, card, sheet, compare) shows the same cover.
 */

type TourPhotos = {
  photosFor: (listingId: string) => Photo[];
  uploadingFor: (listingId: string) => number;
  add: (listingId: string, files: File[]) => Promise<void>;
  remove: (photo: Photo) => Promise<void>;
  memberName: (id: string | null) => string | null;
  coverFor: (listingId: string) => Cover;
  /** "street" or a photo's id. */
  setCover: (listingId: string, cover: string) => void;
  setStreetView: (listingId: string, show: boolean) => void;
};

export const TourPhotosContext = createContext<TourPhotos | null>(null);

export function useTourPhotos(): TourPhotos | null {
  return useContext(TourPhotosContext);
}

/** What the place's photo frames lead with. Without photo storage, that's Street View. */
export function useCover(listingId: string | undefined): Cover {
  const ctx = useTourPhotos();
  return listingId && ctx ? ctx.coverFor(listingId) : { kind: "street" };
}

const addedOn = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });

type Item = { kind: "street"; url: string } | { kind: "photo"; photo: Photo };
const itemKey = (i: Item) => (i.kind === "street" ? "street" : i.photo.id);

/** Street View plus the group's photos, an "Add photos" tile and cover controls. For the place card and the phone sheet. */
export function TourPhotoStrip({
  listing,
  label,
  streetEnabled,
  className
}: {
  listing: Listing;
  label: string;
  /** Whether Street View is configured on this deployment. */
  streetEnabled: boolean;
  className?: string;
}) {
  const ctx = useTourPhotos();
  const inputRef = useRef<HTMLInputElement>(null);
  // The open photo, by key: the list can change while it's open (Street View failing, a roommate's upload).
  const [viewingKey, setViewingKey] = useState<string | null>(null);
  // Street View has no imagery everywhere; drop its tile when the image fails.
  const [streetFailed, setStreetFailed] = useState(false);
  if (!ctx) return null;

  const photos = ctx.photosFor(listing.id);
  const uploading = ctx.uploadingFor(listing.id);
  const full = photos.length + uploading >= MAX_PHOTOS_PER_PLACE;
  const cover = ctx.coverFor(listing.id);
  const coverKey = cover.kind === "photo" ? cover.photo.id : cover.kind;

  const streetSrc = streetEnabled ? streetViewSrc(listing.lat, listing.lng, "sheet") : null;
  const streetThumb = streetEnabled ? streetViewSrc(listing.lat, listing.lng, "row") : null;
  const streetAvailable = streetSrc !== null && !streetFailed;
  const items: Item[] = [
    ...(streetAvailable && listing.streetView ? [{ kind: "street" as const, url: streetSrc }] : []),
    ...photos.map((photo) => ({ kind: "photo" as const, photo }))
  ];
  const found = viewingKey === null ? -1 : items.findIndex((i) => itemKey(i) === viewingKey);
  const viewing = found === -1 ? null : found;
  const view = (i: number | null) => setViewingKey(i === null || !items[i] ? null : itemKey(items[i]));

  return (
    <section aria-label={`Photos of ${label}`} className={className}>
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <h3 className="label text-stone-700">Photos</h3>
        <span className="flex items-baseline gap-3 text-[11px] text-stone-700">
          {streetAvailable && !listing.streetView ? (
            <button
              type="button"
              onClick={() => ctx.setStreetView(listing.id, true)}
              className="inline-flex items-center gap-1 font-semibold text-sea-700 underline underline-offset-2 hover:text-sea-900"
            >
              <Eye className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden="true" />
              Show Street View
            </button>
          ) : null}
          {photos.length ? (
            <span>
              {photos.length} of {MAX_PHOTOS_PER_PLACE}
            </span>
          ) : null}
        </span>
      </div>
      <ul className="flex gap-2 overflow-x-auto pb-1">
        {items.map((item, i) => {
          const isCover = itemKey(item) === coverKey;
          const name =
            item.kind === "street" ? "Open Street View" : `Open photo ${photos.indexOf(item.photo) + 1} of ${photos.length}`;
          return (
            <li key={itemKey(item)} className="shrink-0">
              <button
                type="button"
                onClick={() => view(i)}
                aria-label={isCover ? `${name} (cover)` : name}
                className={cn(
                  "relative block h-14 w-14 overflow-hidden rounded-2xl bg-shell-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sea-700",
                  isCover && "ring-2 ring-sea-700 ring-offset-2 ring-offset-shell"
                )}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.kind === "street" ? (streetThumb ?? item.url) : item.photo.url}
                  alt=""
                  className={cn("h-full w-full object-cover", item.kind === "street" && "photo-tone")}
                  loading="lazy"
                  onError={item.kind === "street" ? () => setStreetFailed(true) : undefined}
                />
                {item.kind === "street" ? (
                  <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-tar/70 py-px text-center text-[8px] font-bold uppercase tracking-wide text-shell">
                    Street
                  </span>
                ) : null}
              </button>
            </li>
          );
        })}
        {Array.from({ length: uploading }, (_, i) => (
          <li key={`up-${i}`} className="shrink-0">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-shell-mid" role="status">
              <Loader2 className="h-5 w-5 animate-spin text-stone-700" aria-hidden="true" />
              <span className="sr-only">Uploading a photo</span>
            </span>
          </li>
        ))}
        {!full ? (
          <li className="shrink-0">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className={cn(
                "flex h-14 items-center justify-center gap-1.5 rounded-2xl border-[1.5px] border-dashed border-stone-400 px-3 text-[13px] font-semibold text-stone-700 hover:border-tar hover:text-tar",
                photos.length + uploading === 0 ? "w-auto" : "w-14 px-0"
              )}
            >
              <ImagePlus className="h-4 w-4 shrink-0" strokeWidth={2.5} aria-hidden="true" />
              {photos.length + uploading === 0 ? "Add photos" : <span className="sr-only">Add photos</span>}
            </button>
          </li>
        ) : null}
      </ul>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        aria-label={`Add photos of ${label}`}
        onChange={(e) => {
          const files = [...(e.target.files ?? [])];
          e.target.value = "";
          if (files.length) void ctx.add(listing.id, files);
        }}
      />
      {viewing !== null && items[viewing] ? (
        <PhotoViewer
          items={items}
          index={viewing}
          label={label}
          coverKey={coverKey}
          photoCount={photos.length}
          memberName={ctx.memberName}
          onIndex={view}
          onClose={() => view(null)}
          onMakeCover={(item) => ctx.setCover(listing.id, itemKey(item))}
          onHideStreet={() => {
            ctx.setStreetView(listing.id, false);
            // Street View is first, so the next photo takes its place.
            view(items[viewing + 1] ? viewing + 1 : null);
          }}
          onDelete={async (p) => {
            const nextItem = items[viewing + 1] ?? items[viewing - 1] ?? null;
            await ctx.remove(p);
            setViewingKey(nextItem ? itemKey(nextItem) : null);
          }}
        />
      ) : null}
    </section>
  );
}

function PhotoViewer({
  items,
  index,
  label,
  coverKey,
  photoCount,
  memberName,
  onIndex,
  onClose,
  onMakeCover,
  onHideStreet,
  onDelete
}: {
  items: Item[];
  index: number;
  label: string;
  coverKey: string;
  photoCount: number;
  memberName: (id: string | null) => string | null;
  onIndex: (i: number) => void;
  onClose: () => void;
  onMakeCover: (item: Item) => void;
  onHideStreet: () => void;
  onDelete: (p: Photo) => Promise<void>;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [deleting, setDeleting] = useState(false);
  const item = items[index]!;
  const prev = () => onIndex((index - 1 + items.length) % items.length);
  const next = () => onIndex((index + 1) % items.length);
  const isCover = itemKey(item) === coverKey;

  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
  }, []);

  let caption: string;
  if (item.kind === "street") {
    caption = "Street View · © Google";
  } else {
    const n = items.filter((i) => i.kind === "photo").indexOf(item) + 1;
    const by = memberName(item.photo.uploadedBy);
    caption = [`Photo ${n} of ${photoCount}`, by ? `added by ${by}` : null, addedOn.format(new Date(item.photo.createdAt))]
      .filter(Boolean)
      .join(" · ");
  }

  const toolButton =
    "inline-flex h-10 items-center gap-1.5 rounded-full bg-shell/10 px-3 text-sm font-semibold hover:bg-shell/20 disabled:opacity-60";

  return (
    <dialog
      ref={ref}
      // React passes a nested dialog's close event up; stop it so the dialog underneath stays open.
      onClose={(e) => {
        e.stopPropagation();
        onClose();
      }}
      onKeyDown={(e) => {
        if (items.length < 2) return;
        if (e.key === "ArrowLeft") prev();
        if (e.key === "ArrowRight") next();
      }}
      aria-label={`Photos of ${label}`}
      className="m-0 h-dvh max-h-none w-full max-w-none bg-tar/95 p-0 text-shell backdrop:bg-tar/60"
    >
      <div className="flex h-full flex-col">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
          <p className="min-w-0 truncate text-sm">
            <span className="font-display">{label}</span> <span className="text-shell/80">· {caption}</span>
          </p>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {isCover ? (
              <span className="inline-flex h-10 items-center gap-1.5 rounded-full bg-sea-700 px-3 text-sm font-semibold">
                <Check className="h-4 w-4" strokeWidth={2.75} aria-hidden="true" />
                Cover photo
              </span>
            ) : (
              <button type="button" onClick={() => onMakeCover(item)} className={toolButton}>
                <Check className="h-4 w-4" strokeWidth={2.5} aria-hidden="true" />
                Make cover
              </button>
            )}
            {item.kind === "street" ? (
              <button type="button" onClick={onHideStreet} className={toolButton}>
                <EyeOff className="h-4 w-4" strokeWidth={2.5} aria-hidden="true" />
                Hide Street View
              </button>
            ) : (
              <button
                type="button"
                disabled={deleting}
                onClick={async () => {
                  if (!window.confirm("Remove this photo for everyone on the board?")) return;
                  setDeleting(true);
                  try {
                    await onDelete(item.photo);
                  } finally {
                    setDeleting(false);
                  }
                }}
                className={toolButton}
              >
                <Trash2 className="h-4 w-4" strokeWidth={2.5} aria-hidden="true" />
                Remove
              </button>
            )}
            <button
              type="button"
              onClick={() => ref.current?.close()}
              aria-label="Close photos"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-shell text-tar"
            >
              <X className="h-5 w-5" strokeWidth={2.75} aria-hidden="true" />
            </button>
          </div>
        </div>
        <div className="relative flex min-h-0 flex-1 items-center justify-center px-2 pb-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            key={itemKey(item)}
            src={item.kind === "street" ? item.url : item.photo.url}
            alt={item.kind === "street" ? `Street View near ${label}` : `Photo of ${label}`}
            className={cn("max-h-full max-w-full rounded-2xl object-contain", item.kind === "street" && "photo-tone")}
          />
          {items.length > 1 ? (
            <>
              <button
                type="button"
                onClick={prev}
                aria-label="Previous photo"
                className="absolute left-3 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-shell text-tar shadow-md"
              >
                <ChevronLeft className="h-5 w-5" strokeWidth={2.75} aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={next}
                aria-label="Next photo"
                className="absolute right-3 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-shell text-tar shadow-md"
              >
                <ChevronRight className="h-5 w-5" strokeWidth={2.75} aria-hidden="true" />
              </button>
            </>
          ) : null}
        </div>
      </div>
    </dialog>
  );
}
