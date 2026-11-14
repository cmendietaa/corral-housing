"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ImagePlus, Loader2, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { cn } from "@/lib/utils";

type Draft = {
  url: string;
  title: string;
  address: string;
  rent: string;
  beds: string;
  baths: string;
  leaseStart: string;
  leaseEnd: string;
  parking: string;
  laundry: string;
  notes: string;
};

function toDraft(l: ListingInput): Draft {
  return {
    url: l.url ?? "",
    title: l.title,
    address: l.address ?? "",
    rent: centsToDollarsInput(l.rentCents),
    beds: l.beds === null ? "" : String(l.beds),
    baths: l.baths === null ? "" : String(l.baths),
    leaseStart: l.leaseStart ?? "",
    leaseEnd: l.leaseEnd ?? "",
    parking: l.parking ?? "",
    laundry: l.laundry ?? "",
    notes: l.notes ?? ""
  };
}

function num(value: string): number | null {
  const v = value.trim();
  if (v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : Number.NaN;
}

const blank = (s: string) => (s.trim() === "" ? null : s.trim());

type Errors = Partial<Record<keyof Draft, string>>;

type Props = {
  open: boolean;
  /** Null when adding a new place. */
  listing: Listing | null;
  onClose: () => void;
  onSubmit: (input: ListingInput) => Promise<void>;
  onDelete?: (listing: Listing) => Promise<void>;
  /** Demo only: a fictional listing screenshot people can try autofill with. */
  sampleScreenshot?: string;
};

/** A screenshot waiting to be read: shrunk in the browser, kept only in memory. */
type Shot = { id: string; blob: Blob; url: string };

export function ListingForm({ open, listing, onClose, onSubmit, onDelete, sampleScreenshot }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const id = useId();
  const base = listing ?? emptyListingInput();
  const [draft, setDraft] = useState<Draft>(() => toDraft(base));
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
  const [shots, setShots] = useState<Shot[]>([]);
  const [preparing, setPreparing] = useState(0);
  const [viewing, setViewing] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const shotsRef = useRef<Shot[]>([]);

  // Release the screenshots' memory when the form closes.
  useEffect(() => {
    shotsRef.current = shots;
  }, [shots]);
  useEffect(() => () => shotsRef.current.forEach((s) => URL.revokeObjectURL(s.url)), []);

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
      const f = body.fields;
      const incoming: Partial<Draft> = {
        url: f.url ?? undefined,
        title: f.title ?? undefined,
        address: f.address ?? undefined,
        rent: f.rentCents === null ? undefined : centsToDollarsInput(f.rentCents),
        beds: f.beds === null ? undefined : String(f.beds),
        baths: f.baths === null ? undefined : String(f.baths),
        leaseStart: f.leaseStart ?? undefined,
        leaseEnd: f.leaseEnd ?? undefined,
        parking: f.parking ?? undefined,
        laundry: f.laundry ?? undefined
      };
      // Computed here (not inside a state updater) so the count below is right.
      const changed = new Set<keyof Draft>();
      const next = { ...draft };
      for (const [k, v] of Object.entries(incoming) as [keyof Draft, string | undefined][]) {
        // Never overwrite something the person already typed.
        if (v !== undefined && v !== "" && next[k].trim() === "") {
          next[k] = v;
          changed.add(k);
        }
      }
      setDraft(next);
      setFilled(changed);
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    const rentCents = parseDollars(draft.rent);
    const beds = num(draft.beds);
    const baths = num(draft.baths);
    const next: Errors = {};
    if (Number.isNaN(rentCents)) next.rent = "Enter a monthly amount like 5400";
    if (Number.isNaN(beds)) next.beds = "Enter a number";
    if (Number.isNaN(baths)) next.baths = "Enter a number";

    const candidate: ListingInput = {
      ...base,
      url: blank(draft.url),
      title: draft.title.trim(),
      address: blank(draft.address),
      rentCents: Number.isNaN(rentCents) ? null : rentCents,
      beds: Number.isNaN(beds) ? null : beds,
      baths: Number.isNaN(baths) ? null : baths,
      leaseStart: blank(draft.leaseStart),
      leaseEnd: blank(draft.leaseEnd),
      parking: (blank(draft.parking) as ListingInput["parking"]) ?? null,
      laundry: (blank(draft.laundry) as ListingInput["laundry"]) ?? null,
      notes: blank(draft.notes)
    };

    const parsed = listingInputSchema.safeParse(candidate);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const key = issue.path[0];
        const field = key === "rentCents" ? "rent" : (key as keyof Draft);
        if (field in draft && !next[field]) next[field] = issue.message;
      }
    }
    if (candidate.leaseStart && candidate.leaseEnd && candidate.leaseEnd < candidate.leaseStart) {
      next.leaseEnd = "Lease end is before the start";
    }
    setErrors(next);
    if (Object.keys(next).length > 0 || !parsed.success) return;

    setSaving(true);
    try {
      await onSubmit(parsed.data);
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

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      aria-labelledby={`${id}-heading`}
      className={cn(
        "overflow-hidden bg-surface p-0 text-ink shadow-lift backdrop:bg-ink/40",
        // Phones: a bottom sheet. Larger screens: a centered panel.
        "max-sm:mb-0 max-sm:mt-auto max-sm:max-h-[92dvh] max-sm:w-full max-sm:max-w-none max-sm:rounded-t-xl",
        "sm:m-auto sm:max-h-[calc(100dvh-3rem)] sm:w-[min(42rem,calc(100vw-3rem))] sm:rounded-xl"
      )}
    >
      <form onSubmit={handleSubmit} noValidate className="flex max-h-[inherit] flex-col">
        <div className="shrink-0 px-5 pt-5 sm:px-7 sm:pt-6">
          <div className="flex items-start justify-between gap-4">
            <h2 id={`${id}-heading`} className="font-display text-2xl font-extrabold leading-tight">
              {listing ? `Edit ${streetHeadline(listing.address, listing.title)}` : "Add a place"}
            </h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="-mr-2 -mt-1 rounded-full p-2 text-muted hover:bg-sand hover:text-ink focus-visible:outline-2 focus-visible:outline-focus"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
          <p className="mt-3 text-sm text-muted">
            Only a name is required. Leave anything you don&apos;t know blank and it shows as
            unknown.
          </p>
        </div>

        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-5 pb-6 pt-5 sm:px-7">
          <div
            className={cn("rounded-[22px] bg-sea-100 p-4", dragging && "outline-2 outline-offset-2 outline-sea-700 outline-dashed")}
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
              className="flex w-full items-center gap-2 text-left"
            >
              <Sparkles className="h-4 w-4 text-sea-700" strokeWidth={2.75} aria-hidden="true" />
              <span className="font-display text-base text-tar">Autofill from the listing</span>
              <span className="ml-auto text-xs font-semibold text-sea-700">{pasteOpen ? "Hide" : "Show"}</span>
            </button>
            {pasteOpen ? (
              <div className="mt-3 space-y-2.5">
                <label htmlFor={`${id}-paste`} className="block text-sm text-stone-800">
                  Paste the listing&apos;s text or add screenshots of it (a post, a chat, a listing page). Corral fills in what
                  it can; you check it before saving. Links aren&apos;t opened and screenshots aren&apos;t saved.
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
                  placeholder={"4BR/2BA duplex near Pardall, $5,400/mo\nAvailable Sept 1, 12-month lease. W/D in unit."}
                  className="w-full rounded-[18px] border border-divider bg-shell-light px-4 py-3 text-sm placeholder:text-stone-600"
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
                      <button
                        type="button"
                        onClick={() => void loadSample()}
                        className="px-1 text-sm font-semibold text-sea-700 underline underline-offset-4"
                      >
                        Try a sample screenshot
                      </button>
                    </li>
                  ) : null}
                </ul>
                <p className="text-xs text-stone-700 max-sm:hidden">You can also paste or drop a screenshot here.</p>
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
                    {autofill.busy ? "Reading…" : "Autofill"}
                  </Button>
                  <span aria-live="polite" className={cn("text-sm", autofill.error ? "font-semibold text-danger" : "text-sea-900")}>
                    {autofill.message}
                  </span>
                </div>
              </div>
            ) : null}
          </div>

          <Section title="The place">
            <Field label="Listing link" htmlFor={`${id}-url`} filled={filled.has("url")} error={errors.url} errorId={`${id}-url-error`} hint="if there is one" wide>
              <Input {...field("url")} type="url" inputMode="url" autoFocus placeholder="https://" />
            </Field>
            <Field
              label="Name"
              htmlFor={`${id}-title`}
              filled={filled.has("title")}
              error={errors.title}
              errorId={`${id}-title-error`}
              hint="A nickname the group will recognize"
              required
              wide
            >
              <Input {...field("title")} maxLength={120} placeholder="Upstairs 4-bed with a balcony" required />
            </Field>
            <Field label="Address" htmlFor={`${id}-address`} filled={filled.has("address")} error={errors.address} errorId={`${id}-address-error`} wide>
              <Input {...field("address")} maxLength={200} placeholder="6512 Sabado Tarde Rd" />
            </Field>
          </Section>

          <Section title="Rent and size">
            <Field
              label="Rent for the whole place"
              htmlFor={`${id}-rent`}
              filled={filled.has("rent")}
              error={errors.rent}
              errorId={`${id}-rent-error`}
              wide
            >
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted">$</span>
                <Input {...field("rent")} inputMode="decimal" placeholder="5400" className="pl-6 pr-12 tabular-nums" />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted">/mo</span>
              </div>
            </Field>
            <Field label="Beds" htmlFor={`${id}-beds`} filled={filled.has("beds")} error={errors.beds} errorId={`${id}-beds-error`}>
              <Input {...field("beds")} inputMode="numeric" placeholder="4" />
            </Field>
            <Field label="Baths" htmlFor={`${id}-baths`} filled={filled.has("baths")} error={errors.baths} errorId={`${id}-baths-error`}>
              <Input {...field("baths")} inputMode="decimal" placeholder="2" />
            </Field>
          </Section>

          <Section title="Lease">
            <Field label="Starts" htmlFor={`${id}-leaseStart`} filled={filled.has("leaseStart")} error={errors.leaseStart} errorId={`${id}-leaseStart-error`}>
              <Input {...field("leaseStart")} type="date" />
            </Field>
            <Field label="Ends" htmlFor={`${id}-leaseEnd`} filled={filled.has("leaseEnd")} error={errors.leaseEnd} errorId={`${id}-leaseEnd-error`}>
              <Input {...field("leaseEnd")} type="date" />
            </Field>
          </Section>

          <Section title="Extras">
            <Field label="Parking" htmlFor={`${id}-parking`} filled={filled.has("parking")}>
              <Select {...field("parking")}>
                <option value="">Don&apos;t know yet</option>
                {PARKING_OPTIONS.map((p) => (
                  <option key={p} value={p}>
                    {PARKING_LABELS[p]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Laundry" htmlFor={`${id}-laundry`} filled={filled.has("laundry")}>
              <Select {...field("laundry")}>
                <option value="">Don&apos;t know yet</option>
                {LAUNDRY_OPTIONS.map((p) => (
                  <option key={p} value={p}>
                    {LAUNDRY_LABELS[p]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Notes" htmlFor={`${id}-notes`} filled={filled.has("notes")} wide>
              <textarea
                {...field("notes")}
                rows={3}
                maxLength={2000}
                placeholder="Anything the group should know: vibe, noise, landlord, deposit…"
                className="w-full rounded-sm border border-line bg-surface px-3 py-2 text-sm placeholder:text-muted/70 hover:border-ocean/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
              />
            </Field>
          </Section>

          {formError ? (
            <p role="alert" className="rounded-sm bg-coral-soft px-3 py-2 text-sm text-danger">
              {formError}
            </p>
          ) : null}
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2 border-t border-line bg-sand/60 px-5 py-3 sm:px-7">
          <Button type="submit" disabled={saving}>
            {listing ? "Save changes" : "Add place"}
          </Button>
          <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          {listing && onDelete ? (
            <Button
              type="button"
              variant="ghost"
              className="ml-auto text-danger hover:text-danger"
              onClick={() => void handleDelete()}
              disabled={saving}
            >
              Remove from board
            </Button>
          ) : null}
        </div>
      </form>
      {viewing !== null && shots[viewing] ? (
        <ScreenshotViewer url={shots[viewing].url} index={viewing} count={shots.length} onClose={() => setViewing(null)} />
      ) : null}
    </dialog>
  );
}

/** A screenshot at full size, so the person can check the filled-in fields against it. */
function ScreenshotViewer({ url, index, count, onClose }: { url: string; index: number; count: number; onClose: () => void }) {
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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="min-w-0">
      <legend className="font-display mb-3 w-full border-b border-line pb-1.5 text-base font-bold text-ink">
        {title}
      </legend>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </fieldset>
  );
}

function Field({
  label,
  htmlFor,
  error,
  errorId,
  hint,
  required,
  wide,
  filled,
  children
}: {
  label: string;
  htmlFor: string;
  error?: string;
  errorId?: string;
  hint?: string;
  required?: boolean;
  wide?: boolean;
  /** Set by Autofill; shows a tag and tints the input until the person edits it. */
  filled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "min-w-0",
        wide && "sm:col-span-2",
        filled && "[&_input]:!border-sea-500 [&_input]:!bg-sea-100 [&_select]:!border-sea-500 [&_select]:!bg-sea-100"
      )}
    >
      <label htmlFor={htmlFor} className="mb-1 flex flex-wrap items-baseline gap-x-1.5 text-sm font-semibold text-ink">
        {label}
        {required ? <span className="text-xs font-medium text-ocean">required</span> : null}
        {filled ? <span className="text-xs font-semibold text-sea-700">autofilled</span> : null}
        {hint ? <span className="text-xs font-normal text-muted">{hint}</span> : null}
      </label>
      {children}
      {error ? (
        <p id={errorId} className="mt-1 text-xs font-medium text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className="h-11 w-full rounded-sm border border-line bg-surface px-2 text-sm hover:border-ocean/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
    />
  );
}
