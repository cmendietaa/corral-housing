"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, ImagePlus, Loader2, Trash2, X } from "lucide-react";
import { MAX_PHOTOS_PER_PLACE, type Photo } from "@/lib/stores/types";
import { cn } from "@/lib/utils";

/**
 * Tour photos: roommates add up to 8 photos per place. The board owns the
 * state and provides it here, so any photo frame (row, card, sheet, compare)
 * can show a place's first tour photo instead of Street View.
 */

type TourPhotos = {
  photosFor: (listingId: string) => Photo[];
  uploadingFor: (listingId: string) => number;
  add: (listingId: string, files: File[]) => Promise<void>;
  remove: (photo: Photo) => Promise<void>;
  memberName: (id: string | null) => string | null;
};

export const TourPhotosContext = createContext<TourPhotos | null>(null);

export function useTourPhotos(): TourPhotos | null {
  return useContext(TourPhotosContext);
}

/** The place's first tour photo, if it has one. */
export function useFirstTourPhoto(listingId: string | undefined): Photo | null {
  const ctx = useTourPhotos();
  return listingId && ctx ? (ctx.photosFor(listingId)[0] ?? null) : null;
}

const addedOn = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });

/** Thumbnails plus an "Add photos" tile, for the place card and the phone sheet. */
export function TourPhotoStrip({ listingId, label, className }: { listingId: string; label: string; className?: string }) {
  const ctx = useTourPhotos();
  const inputRef = useRef<HTMLInputElement>(null);
  const [viewing, setViewing] = useState<number | null>(null);
  if (!ctx) return null;

  const photos = ctx.photosFor(listingId);
  const uploading = ctx.uploadingFor(listingId);
  const full = photos.length + uploading >= MAX_PHOTOS_PER_PLACE;

  return (
    <section aria-label={`Tour photos of ${label}`} className={className}>
      <div className="mb-1.5 flex items-baseline justify-between">
        <h3 className="label text-stone-700">Tour photos</h3>
        {photos.length ? (
          <span className="text-[11px] text-stone-700">
            {photos.length} of {MAX_PHOTOS_PER_PLACE}
          </span>
        ) : null}
      </div>
      <ul className="flex gap-2 overflow-x-auto pb-1">
        {photos.map((p, i) => (
          <li key={p.id} className="shrink-0">
            <button
              type="button"
              onClick={() => setViewing(i)}
              aria-label={`Open tour photo ${i + 1} of ${photos.length}`}
              className="block h-14 w-14 overflow-hidden rounded-2xl bg-shell-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sea-700"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.url} alt="" className="h-full w-full object-cover" loading="lazy" />
            </button>
          </li>
        ))}
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
              {photos.length + uploading === 0 ? "Add photos from your tour" : <span className="sr-only">Add photos</span>}
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
        aria-label={`Add tour photos of ${label}`}
        onChange={(e) => {
          const files = [...(e.target.files ?? [])];
          e.target.value = "";
          if (files.length) void ctx.add(listingId, files);
        }}
      />
      {viewing !== null && photos[viewing] ? (
        <PhotoViewer
          photos={photos}
          index={viewing}
          label={label}
          memberName={ctx.memberName}
          onIndex={setViewing}
          onClose={() => setViewing(null)}
          onDelete={async (p) => {
            await ctx.remove(p);
            const left = photos.length - 1;
            setViewing(left === 0 ? null : Math.min(viewing, left - 1));
          }}
        />
      ) : null}
    </section>
  );
}

function PhotoViewer({
  photos,
  index,
  label,
  memberName,
  onIndex,
  onClose,
  onDelete
}: {
  photos: Photo[];
  index: number;
  label: string;
  memberName: (id: string | null) => string | null;
  onIndex: (i: number) => void;
  onClose: () => void;
  onDelete: (p: Photo) => Promise<void>;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [deleting, setDeleting] = useState(false);
  const photo = photos[index]!;
  const prev = () => onIndex((index - 1 + photos.length) % photos.length);
  const next = () => onIndex((index + 1) % photos.length);

  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
  }, []);

  const by = memberName(photo.uploadedBy);
  const caption = [`Photo ${index + 1} of ${photos.length}`, by ? `added by ${by}` : null, addedOn.format(new Date(photo.createdAt))]
    .filter(Boolean)
    .join(" · ");

  return (
    <dialog
      ref={ref}
      // React passes a nested dialog's close event up; stop it so the dialog underneath stays open.
      onClose={(e) => {
        e.stopPropagation();
        onClose();
      }}
      onKeyDown={(e) => {
        if (photos.length < 2) return;
        if (e.key === "ArrowLeft") prev();
        if (e.key === "ArrowRight") next();
      }}
      aria-label={`Tour photos of ${label}`}
      className="m-0 h-dvh max-h-none w-full max-w-none bg-tar/95 p-0 text-shell backdrop:bg-tar/60"
    >
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <p className="min-w-0 truncate text-sm">
            <span className="font-display">{label}</span> <span className="text-shell/80">· {caption}</span>
          </p>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              disabled={deleting}
              onClick={async () => {
                if (!window.confirm("Remove this photo for everyone on the board?")) return;
                setDeleting(true);
                try {
                  await onDelete(photo);
                } finally {
                  setDeleting(false);
                }
              }}
              className="inline-flex h-10 items-center gap-1.5 rounded-full bg-shell/10 px-3 text-sm font-semibold hover:bg-shell/20 disabled:opacity-60"
            >
              <Trash2 className="h-4 w-4" strokeWidth={2.5} aria-hidden="true" />
              Remove
            </button>
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
          <img src={photo.url} alt={`Tour photo ${index + 1} of ${label}`} className="max-h-full max-w-full rounded-2xl object-contain" />
          {photos.length > 1 ? (
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
