"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ImagePlus, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LassoIcon, EmptyLot, PinIcon, SunMark } from "@/components/brand/motifs";
import { streetHeadline } from "@/lib/address";
import { MAX_SCREENSHOT_BYTES, MAX_SCREENSHOTS } from "@/lib/extract/image";
import { centsToDollarsInput, parseDollars } from "@/lib/format";
import {
  emptyListingInput,
  LAUNDRY_LABELS,
  LAUNDRY_OPTIONS,
  listingInputSchema,
  PARKING_LABELS,
  PARKING_OPTIONS,
  type Listing,
  type ListingInput
} from "@/lib/listing";
import type { ParsedListing } from "@/lib/parse-listing";
import { shrinkScreenshot } from "@/lib/photo-shrink";
import { MAX_PHOTOS_PER_PLACE } from "@/lib/stores/types";
import { cn } from "@/lib/utils";
import { Choices, FieldError, Stepper, Tile } from "./fields";
import { StreetPhoto } from "./street-photo";
import { fillEmpty, parsedToDraft, toDraft, validateDraft, type Draft, type DraftErrors } from "./place-draft";

type Errors = DraftErrors;

type Props = {
  open: boolean;
  /** Null when adding a new place. */
  listing: Listing | null;
  onClose: () => void;
  /** `photos` are images picked in the form (add mode only), uploaded once the place exists. */
  onSubmit: (input: ListingInput, photos: File[]) => Promise<void>;
  onDelete?: (listing: Listing) => Promise<void>;
  /** Demo only: a fictional listing screenshot people can try autofill with. */
  sampleScreenshot?: string;
  /** Whether this board stores photos (shows the Photos section when adding). */
  canAddPhotos?: boolean;
  /** Whether Street View is configured; without it the place shows the empty lot. */
  streetPhotos?: boolean;
};

/** A photo picked while adding a place, previewed from memory until it uploads. */
type Pic = { id: string; file: File; url: string };

/** A screenshot waiting to be read: shrunk in the browser, kept only in memory. */
type Shot = { id: string; blob: Blob; url: string };

export function ListingForm({ open, listing, onClose, onSubmit, onDelete, sampleScreenshot, canAddPhotos = false, streetPhotos = false }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const id = useId();
  const base = listing ?? emptyListingInput();
  const [draft, setDraft] = useState<Draft>(() => toDraft(base));
  // The latest draft, for reads that finish after the person kept typing.
  const latestDraft = useRef(draft);
  useEffect(() => {
    latestDraft.current = draft;
  });
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  // Autofill from pasted listing text (add mode opens it by default).
  const [pasteOpen, setPasteOpen] = useState(!listing);
  const [pasteText, setPasteText] = useState("");
  const [autofill, setAutofill] = useState<{ busy: boolean; message: string | null; error: boolean }>({
    busy: false,
    message: null,
    error: false
  });
  const [filled, setFilled] = useState<Set<keyof Draft>>(new Set());
  const [linkRead, setLinkRead] = useState<{ busy: boolean; message: string | null; tone: "info" | "fallback" | "error" }>({
    busy: false,
    message: null,
    tone: "info"
  });
  const [shots, setShots] = useState<Shot[]>([]);
  const [preparing, setPreparing] = useState(0);
  const [viewing, setViewing] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const shotsRef = useRef<Shot[]>([]);
  const [pics, setPics] = useState<Pic[]>([]);
  const [picNote, setPicNote] = useState<string | null>(null);
  const [picDragging, setPicDragging] = useState(false);
  const picRef = useRef<HTMLInputElement>(null);
  const picsRef = useRef<Pic[]>([]);

  // Release the screenshots' and photos' memory when the form closes.
  useEffect(() => {
    shotsRef.current = shots;
    picsRef.current = pics;
  }, [shots, pics]);
  useEffect(
    () => () => {
      shotsRef.current.forEach((s) => URL.revokeObjectURL(s.url));
      picsRef.current.forEach((p) => URL.revokeObjectURL(p.url));
    },
    []
  );

  function addPics(files: File[]) {
    const images = files.filter((f) => !f.type || f.type.startsWith("image/"));
    if (images.length === 0) return setPicNote("That isn't an image. Add a photo (JPEG, PNG or HEIC).");
    const room = Math.max(0, MAX_PHOTOS_PER_PLACE - pics.length);
    const take = images.slice(0, room);
    setPicNote(take.length < images.length ? `A place can have up to ${MAX_PHOTOS_PER_PLACE} photos, so the extra ones weren't added.` : null);
    setPics((list) => [...list, ...take.map((file) => ({ id: crypto.randomUUID(), file, url: URL.createObjectURL(file) }))]);
  }

  function removePic(id: string) {
    setPics((list) => {
      const gone = list.find((p) => p.id === id);
      if (gone) URL.revokeObjectURL(gone.url);
      return list.filter((p) => p.id !== id);
    });
  }

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const set = (key: keyof Draft) => (value: string) => {
    setDraft((d) => ({ ...d, [key]: value }));
    setFilled((f) => {
      if (!f.has(key)) return f;
      const next = new Set(f);
      next.delete(key);
      return next;
    });
  };

  const say = (message: string, error = false) => setAutofill({ busy: false, message, error });

  /** Shrink each image in the browser (which also drops its metadata) and keep it for Autofill. */
  async function addScreenshots(files: File[]) {
    const images = files.filter((f) => !f.type || f.type.startsWith("image/"));
    if (images.length === 0) return say("That isn't an image. Add a screenshot (PNG or JPEG).", true);
    const room = Math.max(0, MAX_SCREENSHOTS - shots.length - preparing);
    const take = images.slice(0, room);
    if (take.length < images.length) say(`Autofill reads up to ${MAX_SCREENSHOTS} screenshots at a time, so the extra ones weren't added.`);
    else setAutofill((a) => ({ ...a, message: null, error: false }));
    setPreparing((n) => n + take.length);
    await Promise.all(
      take.map(async (file) => {
        try {
          const blob = await shrinkScreenshot(file, MAX_SCREENSHOT_BYTES);
          setShots((list) => [...list, { id: crypto.randomUUID(), blob, url: URL.createObjectURL(blob) }]);
        } catch (err) {
          say(err instanceof Error ? err.message : "Couldn't open that image. Try a PNG or JPEG.", true);
        } finally {
          setPreparing((n) => n - 1);
        }
      })
    );
  }

  function removeShot(id: string) {
    setShots((list) => {
      const gone = list.find((s) => s.id === id);
      if (gone) URL.revokeObjectURL(gone.url);
      return list.filter((s) => s.id !== id);
    });
  }

  async function loadSample() {
    if (!sampleScreenshot) return;
    try {
      const res = await fetch(sampleScreenshot);
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      await addScreenshots([new File([blob], "sample-listing.jpg", { type: blob.type || "image/jpeg" })]);
    } catch {
      say("Couldn't load the sample screenshot. Try again.", true);
    }
  }

  /** Ask the server to read the pasted text and/or screenshots, then fill only the fields that are still empty. */
  async function runAutofill() {
    setAutofill({ busy: true, message: null, error: false });
    const withShots = shots.length > 0;
    try {
      let init: RequestInit;
      if (withShots) {
        const body = new FormData();
        if (pasteText.trim()) body.set("text", pasteText);
        shots.forEach((s, i) => body.append("image", s.blob, `screenshot-${i + 1}.jpg`));
        init = { method: "POST", body };
      } else {
        init = { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: pasteText }) };
      }
      const res = await fetch("/api/parse-listing", init);
      const body = (await res.json()) as { fields?: ParsedListing; source?: "ai" | "parser"; note?: string; error?: string };
      if (!res.ok || !body.fields) {
        setAutofill({ busy: false, message: body.error ?? "Couldn't read that text. Fill the fields in below.", error: true });
        return;
      }
      const changed = fillFrom(body.fields);
      const count = `${changed.size} ${changed.size === 1 ? "field" : "fields"}`;
      const fromShots = withShots && body.source === "ai";
      const message =
        changed.size === 0
          ? fromShots
            ? "Didn't find listing details to fill in. Add them below."
            : "Didn't find anything new to fill in. Add the details below."
          : fromShots
            ? `Filled ${count} from your ${shots.length === 1 ? "screenshot" : "screenshots"}. Check them against it before saving.`
            : `Filled ${count} ${body.source === "ai" ? "with AI" : "with the basic reader"}. Check them before saving.`;
      setAutofill({ busy: false, message: body.note ? `${message} ${body.note}` : message, error: false });
    } catch {
      setAutofill({ busy: false, message: "Couldn't reach the server. Fill the fields in below.", error: true });
    }
  }

  /** Fill only the fields that are still empty; returns which ones changed. */
  function fillFrom(f: ParsedListing): Set<keyof Draft> {
    const { next, changed } = fillEmpty(latestDraft.current, parsedToDraft(f));
    latestDraft.current = next;
    setDraft(next);
    setFilled((prev) => new Set([...prev, ...changed]));
    return changed;
  }

  /**
   * Read the listing link's page and fill what it says. Big listing sites
   * whose terms forbid apps reading them are never fetched; for those (and any
   * site that blocks it) the person is pointed to paste or a screenshot.
   */
  async function importLink() {
    setLinkRead({ busy: true, message: null, tone: "info" });
    try {
      const res = await fetch("/api/import-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: draft.url })
      });
      const body = (await res.json()) as { fields?: ParsedListing; source?: "ai" | "parser"; note?: string; site?: string; fallback?: string; message?: string; error?: string };
      if (body.fallback) {
        setPasteOpen(true);
        setLinkRead({ busy: false, message: body.message ?? "This site can't be read. Paste the text or add a screenshot.", tone: "fallback" });
        return;
      }
      if (!res.ok || !body.fields) {
        setLinkRead({ busy: false, message: body.error ?? "Couldn't read that page. Fill the fields in below.", tone: "error" });
        return;
      }
      const changed = fillFrom(body.fields);
      const count = `${changed.size} ${changed.size === 1 ? "field" : "fields"}`;
      const message =
        changed.size === 0
          ? "Didn't find listing details on that page. Paste the text or add a screenshot instead."
          : `Filled ${count} from ${body.site ?? "the page"}. It can be wrong, so check each one against the listing before saving.`;
      setLinkRead({ busy: false, message: body.note ? `${message} ${body.note}` : message, tone: changed.size ? "info" : "fallback" });
      if (!changed.size) setPasteOpen(true);
    } catch {
      setLinkRead({ busy: false, message: "Couldn't reach the server. Fill the fields in below.", tone: "error" });
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    const { input, errors: next } = validateDraft(draft, base);
    setErrors(next);
    if (!input) return;

    setSaving(true);
    try {
      await onSubmit(input, pics.map((p) => p.file));
      onClose();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Couldn't save this place. Try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!listing || !onDelete) return;
    if (!window.confirm(`Remove “${listing.title}” from the board?`)) return;
    setSaving(true);
    try {
      await onDelete(listing);
      onClose();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Couldn't remove this place. Try again.");
    } finally {
      setSaving(false);
    }
  }

  const field = (key: keyof Draft) => ({
    id: `${id}-${key}`,
    value: draft[key],
    "aria-invalid": errors[key] ? true : undefined,
    "aria-describedby": errors[key] ? `${id}-${key}-error` : undefined,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      set(key)(e.target.value)
  });

  const step1 = (key: "beds" | "baths", delta: number) => {
    const current = Number(draft[key]) || 0;
    set(key)(String(Math.min(20, Math.max(0, current + delta))));
  };
  const headline = listing ? streetHeadline(listing.address, listing.title) : null;
  const canRead = /^https?:\/\/\S+\.\S+/i.test(draft.url.trim());

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      aria-labelledby={`${id}-heading`}
      className={cn(
        "overflow-hidden bg-shell p-0 text-tar shadow-lift backdrop:bg-tar/40",
        // Phones: a bottom sheet. Larger screens: a centered panel.
        "max-sm:mb-0 max-sm:mt-auto max-sm:max-h-[92dvh] max-sm:w-full max-sm:max-w-none max-sm:rounded-t-[30px]",
        "sm:m-auto sm:max-h-[calc(100dvh-3rem)] sm:w-[min(48rem,calc(100vw-3rem))] sm:rounded-[34px]"
      )}
    >
      <form onSubmit={handleSubmit} noValidate className="flex max-h-[inherit] flex-col">
        <div className="flex shrink-0 items-center gap-4 px-5 pb-3 pt-5 sm:px-7 sm:pt-6">
          <h2 id={`${id}-heading`} className="min-w-0 flex-1 font-display text-[24px] leading-tight sm:text-[27px]">
            {headline ? `Edit ${headline}` : "Add a place"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-shell-deep text-tar hover:bg-shell-mid focus-visible:outline-2 focus-visible:outline-focus"
          >
            <X className="h-5 w-5" strokeWidth={2.75} aria-hidden="true" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 pb-5 sm:px-7">
          {/* The place itself: photo, name, where it is. */}
          <div className="flex gap-4 rounded-[26px] bg-shell-light p-3">
            <div className="h-[132px] w-[104px] shrink-0 overflow-hidden rounded-t-[52px] rounded-b-[16px] max-sm:h-[112px] max-sm:w-[86px]">
              {listing && listing.lat !== null && listing.lng !== null ? (
                <StreetPhoto listingId={listing.id} lat={listing.lat} lng={listing.lng} label={headline ?? ""} size="card" enabled={streetPhotos} attribution="tiny" className="h-full w-full" />
              ) : (
                <EmptyLot />
              )}
            </div>
            <div className="flex min-w-0 flex-1 flex-col justify-center gap-2.5">
              <div>
                <label htmlFor={`${id}-title`} className="flex items-center gap-2 text-xs font-bold text-stone-700">
                  Name
                  {filled.has("title") ? <SunMark className="h-4 w-4" label="Rounded up from the listing" /> : null}
                </label>
                <input
                  {...field("title")}
                  maxLength={120}
                  required
                  placeholder="Upstairs 4-bed with a balcony"
                  className="mt-1 w-full border-0 border-b-2 border-sea-500 bg-transparent pb-1 font-display text-[22px] leading-tight text-tar outline-none placeholder:text-stone-500 focus-visible:border-sunset-500"
                />
                <FieldError id={`${id}-title-error`} text={errors.title} />
              </div>
              <div>
                <label htmlFor={`${id}-address`} className="flex items-center gap-2 text-xs font-bold text-stone-700">
                  Address
                  {filled.has("address") ? <SunMark className="h-4 w-4" label="Rounded up from the listing" /> : null}
                </label>
                <div className="mt-1 flex items-center gap-2">
                  <PinIcon className="h-4 w-4 shrink-0 text-sea-700" />
                  <input
                    {...field("address")}
                    maxLength={200}
                    placeholder="6512 Sabado Tarde Rd"
                    className="min-w-0 flex-1 border-0 border-b border-divider bg-transparent py-1 text-[15px] outline-none focus-visible:border-sunset-500"
                  />
                </div>
                <FieldError id={`${id}-address-error`} text={errors.address} />
              </div>
            </div>
          </div>

          {/* The facts, as the same tiles as adding a place. */}
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            <Tile className="col-span-2 sm:col-span-1" found={filled.has("rent")} roped={false} labelFor={`${id}-rent`} label="Rent for the whole place">
              <div className="flex items-baseline gap-1">
                <span className="font-display text-lg text-stone-700">$</span>
                <input
                  {...field("rent")}
                  inputMode="decimal"
                  placeholder="Add rent"
                  className="w-full min-w-0 border-0 bg-transparent font-display text-[22px] tabular-nums outline-none placeholder:text-stone-500"
                />
                <span className="text-sm text-stone-700">/mo</span>
              </div>
              <FieldError id={`${id}-rent-error`} text={errors.rent} />
            </Tile>
            <Tile found={filled.has("beds")} roped={false} labelFor={`${id}-beds`} label="Bedrooms">
              <Stepper inputProps={{ ...field("beds"), inputMode: "numeric" }} zeroLabel="Studio" onValue={set("beds")} less="One fewer bedroom" more="One more bedroom" onStep={(d) => step1("beds", d)} />
              <FieldError id={`${id}-beds-error`} text={errors.beds} />
            </Tile>
            <Tile found={filled.has("baths")} roped={false} labelFor={`${id}-baths`} label="Bathrooms">
              <Stepper inputProps={{ ...field("baths"), inputMode: "decimal" }} less="Half a bathroom fewer" more="Half a bathroom more" onStep={(d) => step1("baths", d / 2)} />
              <FieldError id={`${id}-baths-error`} text={errors.baths} />
            </Tile>
            <Tile className="col-span-2 sm:col-span-1" found={filled.has("leaseStart") || filled.has("leaseEnd")} roped={false} label="Lease">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-1">
                <label className="text-xs text-stone-700">
                  Starts
                  <input {...field("leaseStart")} type="date" className="mt-0.5 flex h-10 w-full items-center rounded-full border border-divider bg-shell-light px-3 py-0 text-sm leading-10 text-tar" />
                </label>
                <label className="text-xs text-stone-700">
                  Ends
                  <input {...field("leaseEnd")} type="date" className="mt-0.5 flex h-10 w-full items-center rounded-full border border-divider bg-shell-light px-3 py-0 text-sm leading-10 text-tar" />
                </label>
              </div>
              <FieldError id={`${id}-leaseEnd-error`} text={errors.leaseEnd ?? errors.leaseStart} />
            </Tile>
            <Tile className="col-span-2 sm:col-span-1" found={filled.has("laundry")} roped={false} label="Laundry">
              <Choices name={`${id}-laundry`} label="Laundry" value={draft.laundry} options={LAUNDRY_OPTIONS.map((o) => [o, LAUNDRY_LABELS[o]])} onChange={set("laundry")} />
            </Tile>
            <Tile className="col-span-2 sm:col-span-1" found={filled.has("parking")} roped={false} label="Parking">
              <Choices name={`${id}-parking`} label="Parking" value={draft.parking} options={PARKING_OPTIONS.map((o) => [o, PARKING_LABELS[o]])} onChange={set("parking")} />
            </Tile>
          </div>

          {/* The link, a way to read it again, and the group's notes. */}
          <div className="space-y-3 rounded-[22px] bg-shell-light p-3.5">
            <div>
              <label htmlFor={`${id}-url`} className="text-xs font-bold text-stone-700">
                Listing link
              </label>
              <div className="mt-1 flex flex-wrap gap-2">
                <input
                  {...field("url")}
                  type="url"
                  inputMode="url"
                  placeholder="https://"
                  className="h-11 min-w-0 flex-1 rounded-full border border-divider bg-shell px-4 text-sm text-tar placeholder:text-stone-600"
                />
                <button
                  type="button"
                  disabled={linkRead.busy || !canRead}
                  onClick={() => void importLink()}
                  className="inline-flex h-11 shrink-0 items-center gap-2 rounded-full border-[1.5px] border-tar bg-shell-light px-4 text-sm font-bold text-tar transition hover:bg-shell-mid disabled:cursor-not-allowed disabled:opacity-45"
                >
                  <LassoIcon className="h-4 w-4" strokeWidth={2.4} />
                  {linkRead.busy ? "Reading…" : "Round it up again"}
                </button>
              </div>
              <FieldError id={`${id}-url-error`} text={errors.url} />
              <p
                aria-live="polite"
                className={cn(
                  "text-sm empty:hidden",
                  linkRead.message && "mt-2",
                  linkRead.tone === "error" ? "font-semibold text-danger" : "text-stone-800"
                )}
              >
                {linkRead.message}
              </p>
            </div>

            <div
              className={cn(dragging && "rounded-[18px] outline-2 outline-offset-4 outline-sea-700 outline-dashed")}
              onDragOver={(e) => {
                if (!e.dataTransfer.types.includes("Files")) return;
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragging(false);
              }}
              onDrop={(e) => {
                if (!e.dataTransfer.files.length) return;
                e.preventDefault();
                setDragging(false);
                setPasteOpen(true);
                void addScreenshots([...e.dataTransfer.files]);
              }}
            >
              <button
                type="button"
                aria-expanded={pasteOpen}
                onClick={() => setPasteOpen((o) => !o)}
                className="text-sm font-bold text-sea-700 underline decoration-2 underline-offset-4"
              >
                {pasteOpen ? "Hide the paste box" : "Paste text or a screenshot"}
              </button>
              {pasteOpen ? (
                <div className="mt-2.5 space-y-2.5">
                  <label htmlFor={`${id}-paste`} className="sr-only">
                    The listing&apos;s text
                  </label>
                  <textarea
                    id={`${id}-paste`}
                    value={pasteText}
                    onChange={(e) => setPasteText(e.target.value)}
                    onPaste={(e) => {
                      const images = [...e.clipboardData.files].filter((f) => f.type.startsWith("image/"));
                      if (images.length === 0) return;
                      // An image on its own shouldn't paste its file name as text.
                      if (!e.clipboardData.getData("text/plain")) e.preventDefault();
                      void addScreenshots(images);
                    }}
                    rows={4}
                    maxLength={8000}
                    placeholder={"Paste the listing's text, or a screenshot.\n4BR/2BA duplex near Pardall, $5,400/mo…"}
                    className="w-full rounded-[18px] border border-divider bg-shell px-4 py-3 text-sm placeholder:text-stone-600"
                  />
                  <ul aria-label="Screenshots" className="flex flex-wrap items-center gap-2.5">
                    {shots.map((s, i) => (
                      <li key={s.id} className="relative">
                        <button
                          type="button"
                          onClick={() => setViewing(i)}
                          aria-label={`View screenshot ${i + 1}`}
                          className="block h-16 w-12 overflow-hidden rounded-xl border border-divider bg-shell-light focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sea-700"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={s.url} alt="" className="h-full w-full object-cover object-top" />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeShot(s.id)}
                          aria-label={`Remove screenshot ${i + 1}`}
                          className="absolute -right-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full bg-tar text-shell shadow-sm"
                        >
                          <X className="h-3.5 w-3.5" strokeWidth={3} aria-hidden="true" />
                        </button>
                      </li>
                    ))}
                    {Array.from({ length: preparing }, (_, i) => (
                      <li key={`prep-${i}`} role="status" className="flex h-16 w-12 items-center justify-center rounded-xl bg-shell-mid">
                        <Loader2 className="h-4 w-4 animate-spin text-stone-700" aria-hidden="true" />
                        <span className="sr-only">Preparing a screenshot</span>
                      </li>
                    ))}
                    {shots.length + preparing < MAX_SCREENSHOTS ? (
                      <li>
                        <button
                          type="button"
                          onClick={() => fileRef.current?.click()}
                          className="flex h-11 items-center gap-1.5 rounded-full border-[1.5px] border-dashed border-sea-700 px-3.5 text-sm font-semibold text-sea-900 hover:bg-sea-200/50"
                        >
                          <ImagePlus className="h-4 w-4" strokeWidth={2.5} aria-hidden="true" />
                          {shots.length ? "Add another" : "Add screenshot"}
                        </button>
                      </li>
                    ) : null}
                    {sampleScreenshot && shots.length + preparing === 0 ? (
                      <li>
                        <button type="button" onClick={() => void loadSample()} className="px-1 text-sm font-semibold text-sea-700 underline underline-offset-4">
                          Try a sample screenshot
                        </button>
                      </li>
                    ) : null}
                  </ul>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    multiple
                    hidden
                    aria-label="Add screenshots of the listing"
                    onChange={(e) => {
                      const files = [...(e.target.files ?? [])];
                      e.target.value = "";
                      if (files.length) void addScreenshots(files);
                    }}
                  />
                  <div className="flex flex-wrap items-center gap-3">
                    <Button
                      type="button"
                      variant="sea"
                      size="sm"
                      disabled={autofill.busy || preparing > 0 || (pasteText.trim().length < 10 && shots.length === 0)}
                      onClick={() => void runAutofill()}
                    >
                      {autofill.busy ? "Reading…" : "Fill in from this"}
                    </Button>
                    <span aria-live="polite" className={cn("text-sm", autofill.error ? "font-semibold text-danger" : "text-sea-900")}>
                      {autofill.message}
                    </span>
                  </div>
                </div>
              ) : null}
            </div>

            <div>
              <label htmlFor={`${id}-notes`} className="text-xs font-bold text-stone-700">
                Notes
              </label>
              <textarea
                {...field("notes")}
                rows={3}
                maxLength={2000}
                placeholder="Anything the group should know: noise, landlord, deposit…"
                className="mt-1 w-full rounded-[18px] border border-divider bg-shell px-4 py-3 text-sm placeholder:text-stone-600"
              />
            </div>
          </div>

          {!listing && canAddPhotos ? (
            <fieldset
              className={cn("min-w-0 rounded-[22px] bg-shell-light p-3.5", picDragging && "outline-2 outline-offset-4 outline-sea-700 outline-dashed")}
              onDragOver={(e) => {
                if (!e.dataTransfer.types.includes("Files")) return;
                e.preventDefault();
                setPicDragging(true);
              }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setPicDragging(false);
              }}
              onDrop={(e) => {
                if (!e.dataTransfer.files.length) return;
                e.preventDefault();
                setPicDragging(false);
                addPics([...e.dataTransfer.files]);
              }}
            >
              <legend className="float-left mb-2 w-full text-xs font-bold text-stone-700">Photos</legend>
              <ul aria-label="Photos to add" className="clear-both flex flex-wrap items-center gap-2.5">
                {pics.map((p, i) => (
                  <li key={p.id} className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.url} alt={`Photo ${i + 1} to add`} className="h-16 w-12 rounded-t-[24px] rounded-b-[9px] object-cover" />
                    <button
                      type="button"
                      onClick={() => removePic(p.id)}
                      aria-label={`Remove photo ${i + 1}`}
                      className="absolute -right-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full bg-tar text-shell shadow-sm"
                    >
                      <X className="h-3.5 w-3.5" strokeWidth={3} aria-hidden="true" />
                    </button>
                  </li>
                ))}
                {pics.length < MAX_PHOTOS_PER_PLACE ? (
                  <li>
                    <button
                      type="button"
                      onClick={() => picRef.current?.click()}
                      className="flex h-11 items-center gap-1.5 rounded-full border-[1.5px] border-dashed border-stone-400 px-3.5 text-sm font-semibold text-stone-700 hover:border-tar hover:text-tar"
                    >
                      <ImagePlus className="h-4 w-4" strokeWidth={2.5} aria-hidden="true" />
                      {pics.length ? "Add more" : "Add photos"}
                    </button>
                  </li>
                ) : null}
              </ul>
              {picNote ? (
                <p aria-live="polite" className="mt-2 text-xs font-semibold text-danger">
                  {picNote}
                </p>
              ) : null}
              <input
                ref={picRef}
                type="file"
                accept="image/*"
                multiple
                hidden
                aria-label="Add photos of this place"
                onChange={(e) => {
                  const files = [...(e.target.files ?? [])];
                  e.target.value = "";
                  if (files.length) addPics(files);
                }}
              />
            </fieldset>
          ) : null}

          {formError ? (
            <p role="alert" className="text-sm font-semibold text-danger">
              {formError}
            </p>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center gap-2 bg-shell-deep px-5 py-3.5 sm:gap-3 sm:px-7">
          {listing && onDelete ? (
            <button
              type="button"
              onClick={() => void handleDelete()}
              disabled={saving}
              aria-label="Remove from board"
              className="inline-flex items-center gap-2 text-sm font-bold text-danger disabled:opacity-50"
            >
              <span aria-hidden="true" className="block h-5 w-2 origin-bottom rotate-[16deg] rounded-t-full rounded-b-[2px] bg-stone-400" />
              <span className="sm:hidden">Remove</span>
              <span className="max-sm:hidden">Remove from board</span>
            </button>
          ) : null}
          <span className="flex-1" />
          <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {listing ? "Save changes" : "Add place"}
          </Button>
        </div>
      </form>
      {viewing !== null && shots[viewing] ? (
        <ScreenshotViewer url={shots[viewing].url} index={viewing} count={shots.length} onClose={() => setViewing(null)} />
      ) : null}
    </dialog>
  );
}

/** A screenshot at full size, so the person can check the filled-in fields against it. */
export function ScreenshotViewer({ url, index, count, onClose }: { url: string; index: number; count: number; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      // React passes a nested dialog's close event up; stop it so the dialog underneath stays open.
      onClose={(e) => {
        e.stopPropagation();
        onClose();
      }}
      aria-label={`Screenshot ${index + 1} of ${count}`}
      className="m-0 h-dvh max-h-none w-full max-w-none bg-tar/95 p-0 text-shell backdrop:bg-tar/60"
    >
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <p className="text-sm">
            Screenshot {index + 1} of {count} <span className="text-shell/80">· only in this browser, never saved</span>
          </p>
          <button
            type="button"
            onClick={() => ref.current?.close()}
            aria-label="Close screenshot"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-shell text-tar"
          >
            <X className="h-5 w-5" strokeWidth={2.75} aria-hidden="true" />
          </button>
        </div>
        <div className="flex min-h-0 flex-1 items-center justify-center px-2 pb-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt={`Screenshot ${index + 1} of the listing`} className="max-h-full max-w-full rounded-2xl object-contain" />
        </div>
      </div>
    </dialog>
  );
}
