"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ArrowLeft, ArrowUpRight, Minus, Plus, X } from "lucide-react";
import { FenceIcon, FenceRow, KnotIcon, LassoIcon, PinIcon, SettingSun, SunMark } from "@/components/brand/motifs";
import { MAX_SCREENSHOT_BYTES, MAX_SCREENSHOTS } from "@/lib/extract/image";
import { streetHeadline } from "@/lib/address";
import { commuteToCampus } from "@/lib/commute";
import { formatRent } from "@/lib/compare";
import { parseDollars } from "@/lib/format";
import { lookupPin } from "@/lib/geocode-client";
import { emptyListingInput, LAUNDRY_LABELS, LAUNDRY_OPTIONS, PARKING_LABELS, PARKING_OPTIONS, type ListingInput } from "@/lib/listing";
import type { ParsedListing } from "@/lib/parse-listing";
import { shrinkScreenshot } from "@/lib/photo-shrink";
import { MAX_PHOTOS_PER_PLACE } from "@/lib/stores/types";
import { cn } from "@/lib/utils";
import { asLink, fillEmpty, parsedToDraft, toDraft, validateDraft, type Draft, type DraftErrors } from "./place-draft";
import type { SentPage } from "@/lib/send/payload";
import { ScreenshotViewer } from "./listing-form";
import { FenceFallback, StreetPhoto } from "./street-photo";

type Props = {
  onClose: () => void;
  /** `photos` are images picked here, uploaded once the place exists. */
  /** Returns the new place (with its pin, once the board has placed it). */
  onSubmit: (input: ListingInput, photos: File[]) => Promise<{ lat: number | null; lng: number | null } | void>;
  /** Whether this board stores tour photos. */
  canAddPhotos?: boolean;
  /** Demo only: a fictional listing screenshot to try. */
  sampleScreenshot?: string;
  /** Whether Street View is set up, for the preview photo. */
  streetPhotos?: boolean;
  /** After adding: start a fresh add (the "Round up another" button). */
  onAnother?: () => void;
  /** A listing sent from the browser (Send to Corral): read it right away. */
  incoming?: SentPage;
  /** How many roommates split the rent, and their budget each, for the "each" line. */
  people: number | null;
  budgetPerPersonCents: number | null;
};

type Shot = { id: string; blob: Blob; url: string };
type Pic = { id: string; file: File; url: string };
type Found = { count: number; from: string; rentMissing: boolean };
type Note = { text: string; tone: "info" | "fallback" | "error" } | null;

const FACT_KEYS: (keyof Draft)[] = ["title", "address", "rent", "beds", "baths", "leaseStart", "leaseEnd", "parking", "laundry"];

/**
 * Adding a place, in two steps:
 * 1. Round it up: paste a link, the listing's text or screenshots, and Corral
 *    reads it (or start from an address, or fill it in by hand).
 * 2. Check what Corral found: every fact on one screen, found ones marked with
 *    the setting sun, missing ones roped off, nothing saved until you say so.
 */
export function AddPlaceFlow({ onClose, onSubmit, onAnother, incoming, canAddPhotos = false, sampleScreenshot, streetPhotos = false, people, budgetPerPersonCents }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  const [step, setStep] = useState<"capture" | "check">("capture");
  const [draft, setDraft] = useState<Draft>(() => toDraft(emptyListingInput()));
  const [filled, setFilled] = useState<Set<keyof Draft>>(new Set());
  const [found, setFound] = useState<Found | null>(null);
  const [errors, setErrors] = useState<DraftErrors>({});
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const focusOn = useRef<keyof Draft | null>(null);

  // Step 1
  const [capture, setCapture] = useState("");
  const [shots, setShots] = useState<Shot[]>([]);
  const [preparing, setPreparing] = useState(0);
  const [reading, setReading] = useState<string | null>(null);
  const [landed, setLanded] = useState<number | null>(null);
  const [entering, setEntering] = useState(false);
  const [added, setAdded] = useState<{ name: string; photo: string | null; pin: { lat: number; lng: number } | null } | null>(null);
  // The listing's own photos, offered on the check screen; nothing is kept unless picked.
  const [offered, setOffered] = useState<string[]>([]);
  const [picked, setPicked] = useState<string[]>([]);
  const readAbort = useRef<AbortController | null>(null);
  const [note, setNote] = useState<Note>(null);
  const [dragging, setDragging] = useState(false);
  const [viewing, setViewing] = useState<number | null>(null);
  const shotInput = useRef<HTMLInputElement>(null);

  // Step 2
  const [pics, setPics] = useState<Pic[]>([]);
  const [picNote, setPicNote] = useState<string | null>(null);
  const picInput = useRef<HTMLInputElement>(null);
  const [notesOpen, setNotesOpen] = useState(false);
  const [lookedUp, setLookedUp] = useState<string | null>(null);
  const [pin, setPin] = useState<{ lat: number; lng: number; for: string } | null>(null);

  // Free the screenshots' and photos' memory when the flow closes.
  const memory = useRef<{ shots: Shot[]; pics: Pic[] }>({ shots: [], pics: [] });
  useEffect(() => {
    memory.current = { shots, pics };
  }, [shots, pics]);
  useEffect(
    () => () => {
      memory.current.shots.forEach((s) => URL.revokeObjectURL(s.url));
      memory.current.pics.forEach((p) => URL.revokeObjectURL(p.url));
    },
    []
  );

  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
    // Safari focuses the first button in a new dialog (the close button); start in the paste box instead.
    document.getElementById(`${id}-capture`)?.focus();
  }, [id]);

  // Step 2 places the pin from the address as it's typed, for the photo and the bike time.
  const address = draft.address.trim();
  useEffect(() => {
    if (step !== "check" || !/\d/.test(address)) return;
    let cancelled = false;
    const t = window.setTimeout(() => {
      void lookupPin(address).then((p) => {
        if (cancelled) return;
        setPin(p ? { ...p, for: address } : null);
        setLookedUp(address);
      });
    }, 600);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [step, address]);
  const pinned = pin && pin.for === address ? pin : null;
  const findingPin = /\d/.test(address) && !pinned && lookedUp !== address;

  // Focus the field a "start from…" choice points at, once step 2 is on screen.
  useEffect(() => {
    if (step !== "check" || !focusOn.current) return;
    document.getElementById(`${id}-${focusOn.current}`)?.focus();
    focusOn.current = null;
  }, [step, id]);

  const set = (key: keyof Draft) => (value: string) => {
    setDraft((d) => ({ ...d, [key]: value }));
    setFilled((f) => {
      if (!f.has(key)) return f;
      const next = new Set(f);
      next.delete(key);
      return next;
    });
    setErrors((e) => (e[key] ? { ...e, [key]: undefined } : e));
  };

  // ---------------------------------------------------------------- step 1

  async function addShots(files: File[]) {
    const images = files.filter((f) => !f.type || f.type.startsWith("image/"));
    if (images.length === 0) return setNote({ text: "That isn't an image. Add a screenshot (PNG or JPEG).", tone: "error" });
    const room = Math.max(0, MAX_SCREENSHOTS - shots.length - preparing);
    const take = images.slice(0, room);
    setNote(take.length < images.length ? { text: `Corral reads up to ${MAX_SCREENSHOTS} screenshots at a time, so the extra ones weren't added.`, tone: "info" } : null);
    setPreparing((n) => n + take.length);
    await Promise.all(
      take.map(async (file) => {
        try {
          const blob = await shrinkScreenshot(file, MAX_SCREENSHOT_BYTES);
          setShots((list) => [...list, { id: crypto.randomUUID(), blob, url: URL.createObjectURL(blob) }]);
        } catch (err) {
          setNote({ text: err instanceof Error ? err.message : "Couldn't open that image. Try a PNG or JPEG.", tone: "error" });
        } finally {
          setPreparing((n) => n - 1);
        }
      })
    );
  }

  function removeShot(shotId: string) {
    setShots((list) => {
      const gone = list.find((s) => s.id === shotId);
      if (gone) URL.revokeObjectURL(gone.url);
      return list.filter((s) => s.id !== shotId);
    });
  }

  async function loadSample() {
    if (!sampleScreenshot) return;
    try {
      const res = await fetch(sampleScreenshot);
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      await addShots([new File([blob], "sample-listing.jpg", { type: blob.type || "image/jpeg" })]);
    } catch {
      setNote({ text: "Couldn't load the sample screenshot. Try again.", tone: "error" });
    }
  }

  /** Keep what was found, then move on to checking it. */
  /**
   * Keep what was found, then move on to checking it: the loading scene lands
   * first (the fence finishes, the count shows), then the check view rises in.
   * Facts Corral filled on an earlier read are replaced; anything typed is kept.
   */
  async function arrive(fields: ParsedListing, from: string, base: Draft = draft, photos: string[] = []) {
    const fresh = { ...base };
    for (const k of filled) fresh[k] = "";
    const { next, changed } = fillEmpty(fresh, parsedToDraft(fields));
    const facts = [...changed].filter((k) => FACT_KEYS.includes(k));
    setLanded(facts.length);
    await new Promise((done) => window.setTimeout(done, reducedMotion() ? 0 : 1100));
    setDraft(next);
    setFilled(new Set(facts));
    setFound({ count: facts.length, from, rentMissing: next.rent.trim() === "" });
    setOffered(canAddPhotos ? photos : []);
    setPicked([]);
    setEntering(true);
    setStep("check");
    setLanded(null);
  }

  const link = asLink(capture);
  const canRead = !reading && preparing === 0 && (link !== null || capture.trim().length >= 10 || shots.length > 0);

  async function roundUp() {
    const abort = new AbortController();
    readAbort.current = abort;
    setReading(link && shots.length === 0 ? new URL(link).hostname.replace(/^www\./, "") : shots.length ? (shots.length === 1 ? "your screenshot" : "your screenshots") : "the listing");
    setNote(null);
    try {
      if (link && shots.length === 0) {
        // The link is kept on the place whatever happens next.
        const withLink = { ...draft, url: link };
        setDraft(withLink);
        const res = await fetch("/api/import-link", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: link }), signal: abort.signal });
        const body = (await res.json()) as { fields?: ParsedListing; site?: string; photos?: string[]; note?: string; fallback?: string; message?: string; error?: string };
        if (body.fallback) {
          setCapture("");
          setNote({ text: body.message ?? "Corral can't read that site. Paste the listing's text or add a screenshot instead.", tone: "fallback" });
          return;
        }
        if (!res.ok || !body.fields) {
          setNote({ text: body.error ?? "Couldn't read that page. Paste the listing's text or add a screenshot instead.", tone: "error" });
          return;
        }
        await arrive(body.fields, body.site ?? "the listing page", withLink, body.photos ?? []);
        return;
      }

      let init: RequestInit;
      if (shots.length) {
        const form = new FormData();
        if (capture.trim()) form.set("text", capture);
        shots.forEach((s, i) => form.append("image", s.blob, `screenshot-${i + 1}.jpg`));
        init = { method: "POST", body: form };
      } else {
        init = { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: capture }) };
      }
      const res = await fetch("/api/parse-listing", { ...init, signal: abort.signal });
      const body = (await res.json()) as { fields?: ParsedListing; source?: "ai" | "parser"; error?: string };
      if (!res.ok || !body.fields) {
        setNote({ text: body.error ?? "Couldn't read that. Try again, or fill it in by hand.", tone: "error" });
        return;
      }
      await arrive(body.fields, shots.length ? (shots.length === 1 ? "your screenshot" : "your screenshots") : "what you pasted");
    } catch (err) {
      // Stopped on purpose: back to the paste box, no message.
      if (!(err instanceof DOMException && err.name === "AbortError")) {
        setNote({ text: "Couldn't reach Corral. Check your connection and try again.", tone: "error" });
      }
    } finally {
      readAbort.current = null;
      setReading(null);
    }
  }

  /** Send to Corral: the page came from the person's own browser, so Corral just reads its text. */
  async function readSent(page: SentPage) {
    const abort = new AbortController();
    readAbort.current = abort;
    const site = new URL(page.url).hostname.replace(/^www\./, "");
    setReading(site);
    setNote(null);
    const withLink = { ...draft, url: page.url };
    setDraft(withLink);
    try {
      const res = await fetch("/api/import-page", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(page), signal: abort.signal });
      const body = (await res.json()) as { fields?: ParsedListing; site?: string; photos?: string[]; error?: string };
      if (!res.ok || !body.fields) {
        setNote({ text: body.error ?? "Couldn't read that page. Paste the listing's text or add a screenshot instead.", tone: "error" });
        return;
      }
      await arrive(body.fields, body.site ?? site, withLink, body.photos ?? []);
    } catch (err) {
      if (!(err instanceof DOMException && err.name === "AbortError")) {
        setNote({ text: "Couldn't reach Corral. Check your connection and try again.", tone: "error" });
      }
    } finally {
      readAbort.current = null;
      setReading(null);
    }
  }

  // A sent page starts reading as soon as the window opens.
  const started = useRef(false);
  useEffect(() => {
    if (!incoming || started.current) return;
    started.current = true;
    void readSent(incoming);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, for the page this window opened with
  }, [incoming]);

  function startBy(focus: keyof Draft) {
    setFound(null);
    setOffered([]);
    setPicked([]);
    focusOn.current = focus;
    setStep("check");
  }

  // ---------------------------------------------------------------- step 2

  function addPics(files: File[]) {
    const images = files.filter((f) => !f.type || f.type.startsWith("image/"));
    if (images.length === 0) return setPicNote("That isn't an image. Add a photo (JPEG, PNG or HEIC).");
    const room = Math.max(0, MAX_PHOTOS_PER_PLACE - pics.length);
    const take = images.slice(0, room);
    setPicNote(take.length < images.length ? `A place can have up to ${MAX_PHOTOS_PER_PLACE} photos, so the extra ones weren't added.` : null);
    setPics((list) => [...list, ...take.map((file) => ({ id: crypto.randomUUID(), file, url: URL.createObjectURL(file) }))]);
  }

  function removePic(picId: string) {
    setPics((list) => {
      const gone = list.find((p) => p.id === picId);
      if (gone) URL.revokeObjectURL(gone.url);
      return list.filter((p) => p.id !== picId);
    });
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    const { input, errors: next } = validateDraft(draft, emptyListingInput());
    setErrors(next);
    if (!input) {
      const first = Object.keys(next)[0];
      if (first) document.getElementById(`${id}-${first}`)?.focus();
      return;
    }
    setSaving(true);
    try {
      const got = await fetchPicked(picked);
      if (got.length < picked.length) {
        // Don't save without photos they chose: unpick the ones that failed and say so.
        const kept = new Set(got.map((g) => g.src));
        const lost = picked.length - got.length;
        setPicked((list) => list.filter((src) => kept.has(src)));
        setFormError(`Couldn't keep ${lost === 1 ? "one of the listing photos" : `${lost} of the listing photos`}, so ${lost === 1 ? "it's" : "they're"} unpicked. Press Into the corral again.`);
        return;
      }
      const fromListing = got.map((g) => g.file);
      const created = await onSubmit(pinned ? { ...input, lat: pinned.lat, lng: pinned.lng } : input, [...fromListing, ...pics.map((p) => p.file)]);
      // A moment before the board: the place drops into the corral. Its street photo uses the
      // board's pin, which is there even when the address lookup here hadn't finished.
      const pin = created && created.lat !== null && created.lng !== null ? { lat: created.lat, lng: created.lng } : pinned;
      setAdded({ name: streetHeadline(input.address, input.title), photo: fromListing[0] ? URL.createObjectURL(fromListing[0]) : (pics[0]?.url ?? null), pin });
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Couldn't add this place. Try again.");
    } finally {
      setSaving(false);
    }
  }

  const rentCents = parseDollars(draft.rent);
  const each = rentCents && people ? Math.round(rentCents / people) : null;
  const commute = pinned ? commuteToCampus(pinned.lat, pinned.lng) : null;
  const roped = (key: keyof Draft) => Boolean(found && found.count > 0 && draft[key].trim() === "");
  const field = (key: keyof Draft) => ({
    id: `${id}-${key}`,
    value: draft[key],
    "aria-invalid": errors[key] ? true : undefined,
    "aria-describedby": errors[key] ? `${id}-${key}-error` : undefined,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => set(key)(e.target.value)
  });
  const step1 = (key: "beds" | "baths", delta: number) => {
    const current = Number(draft[key]) || 0;
    const next = Math.min(20, Math.max(0, current + delta));
    set(key)(String(next));
  };

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-label="Add a place"
      className={cn(
        "overflow-hidden bg-shell p-0 text-tar shadow-lift backdrop:bg-tar/45",
        "max-sm:mb-0 max-sm:mt-auto max-sm:h-[94dvh] max-sm:max-h-none max-sm:w-full max-sm:max-w-none max-sm:rounded-t-[30px]",
        // A steady height on desktop, so the window doesn't jump between pasting, loading and checking.
        "sm:m-auto sm:h-[min(46rem,calc(100dvh-3rem))] sm:max-h-none sm:w-[min(46rem,calc(100vw-3rem))] sm:rounded-[32px]"
      )}
    >
      {added ? (
        <IntoTheCorral
          name={added.name}
          photo={added.photo}
          pin={added.pin}
          streetPhotos={streetPhotos}
          onSee={() => ref.current?.close()}
          onAnother={onAnother ? () => onAnother() : undefined}
        />
      ) : step === "capture" ? (
        <div className="flex h-full flex-col">
          {/* The band: sunset sky, a low sun, the stripe and the wave. */}
          <div className="relative shrink-0 overflow-hidden bg-sunset-300 px-5 pb-5 pt-5 sm:px-8 sm:pt-7">
            <span aria-hidden="true" className="absolute -bottom-16 right-24 h-32 w-32 rounded-full bg-sunset-200 sm:right-36" />
            <div className="relative flex items-start gap-4">
              <div className="min-w-0 flex-1">
                <h2 id={`${id}-heading`} className="font-display text-[30px] leading-none sm:text-[34px]">
                  Add a place
                </h2>
              </div>
              <button
                type="button"
                onClick={() => ref.current?.close()}
                aria-label="Close"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-shell-light/70 transition hover:bg-shell-light"
              >
                <X className="h-5 w-5" strokeWidth={2.75} aria-hidden="true" />
              </button>
            </div>
          </div>
          <div aria-hidden="true" className="corral-stripe h-4 shrink-0" />
          <div aria-hidden="true" className="corral-wave shrink-0" />

          {reading ? (
            <RoundingUp what={reading} landed={landed} onStop={() => readAbort.current?.abort()} />
          ) : (
          <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-6 pt-3 sm:px-8">
            {/* The pen: a little fence behind a box you toss things into. */}
            <div
              className="relative pt-7"
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
                void addShots([...e.dataTransfer.files]);
              }}
            >
              <FenceRow className="absolute left-6 top-0" />
              <section aria-labelledby={`${id}-roundup`} className="relative overflow-hidden rounded-[30px] bg-shell-deep">
                <div className="flex items-center gap-3 px-5 pt-5">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-sunset-300 text-sunset-700">
                    <LassoIcon className="h-6 w-6" />
                  </span>
                  <h3 id={`${id}-roundup`} className="min-w-0 font-display text-[22px] leading-tight">
                    Round it up
                  </h3>
                </div>

                <div className="mx-5 mt-4 overflow-hidden rounded-[18px] bg-shell-light shadow-[0_1px_0_rgb(32_30_29/0.08)]">
                  <span aria-hidden="true" className="corral-stripe-x block h-2" />
                  <label htmlFor={`${id}-capture`} className="sr-only">
                    Paste a link or the listing&apos;s text
                  </label>
                  <textarea
                    id={`${id}-capture`}
                    value={capture}
                    onChange={(e) => {
                      setCapture(e.target.value);
                      if (note?.tone === "error") setNote(null);
                    }}
                    onPaste={(e) => {
                      const images = [...e.clipboardData.files].filter((f) => f.type.startsWith("image/"));
                      if (images.length === 0) return;
                      if (!e.clipboardData.getData("text/plain")) e.preventDefault();
                      void addShots(images);
                    }}
                    rows={3}
                    maxLength={8000}
                    placeholder="Paste a link, the listing, or a group-chat message"
                    className="block w-full resize-none border-0 bg-shell-light px-4 py-3 text-[15px] leading-relaxed text-tar outline-none placeholder:text-stone-600"
                  />
                </div>
                {link ? (
                  <p className="mx-5 mt-2 inline-flex items-center gap-2 rounded-full bg-shell-light py-1 pl-1.5 pr-3 text-[13px] font-semibold text-sea-900">
                    <SunMark className="h-5 w-5" />
                    Link spotted. Corral will read that page.
                  </p>
                ) : null}

                {/* The loop: screenshots go in the rope. */}
                <div
                  className={cn(
                    "relative mx-5 mt-4 flex min-h-[72px] flex-wrap items-center gap-3 rounded-[42px] border-[3px] border-dashed border-sunset-600 px-5 py-3",
                    dragging && "bg-sunset-100"
                  )}
                >
                  {shots.length > 0 ? (
                    <ul aria-label="Screenshots" className="flex items-center gap-2">
                      {shots.map((s, i) => (
                        <li key={s.id} className="relative">
                          <button type="button" onClick={() => setViewing(i)} aria-label={`View screenshot ${i + 1}`} className="block">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={s.url} alt="" className={cn("h-14 w-10 rounded-lg border border-divider object-cover object-top", i % 2 ? "rotate-3" : "-rotate-3")} />
                          </button>
                          <button
                            type="button"
                            onClick={() => removeShot(s.id)}
                            aria-label={`Remove screenshot ${i + 1}`}
                            className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-tar text-shell"
                          >
                            <X className="h-3 w-3" strokeWidth={3} aria-hidden="true" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {preparing > 0 ? <SettingSun label="Preparing a screenshot" /> : null}
                  <div className="min-w-0 flex-1">
                    {shots.length + preparing < MAX_SCREENSHOTS ? (
                      <button type="button" onClick={() => shotInput.current?.click()} className="text-left">
                        <span className="block text-[15px] font-bold text-sunset-800">
                          {shots.length ? "Add another screenshot" : "Drop screenshots in the loop"}
                        </span>
                      </button>
                    ) : (
                      <span className="text-[13px] text-stone-800">That&apos;s {MAX_SCREENSHOTS}, the most Corral reads at once.</span>
                    )}
                    {sampleScreenshot && shots.length + preparing === 0 ? (
                      <button type="button" onClick={() => void loadSample()} className="mt-1 block text-[13px] font-semibold text-sea-700 underline underline-offset-4">
                        Try a sample screenshot
                      </button>
                    ) : null}
                  </div>
                  <KnotIcon className="absolute -bottom-[18px] right-10 h-9 w-9 rounded-full bg-shell-deep text-sunset-600" />
                  <input
                    ref={shotInput}
                    type="file"
                    accept="image/*"
                    multiple
                    hidden
                    aria-label="Add screenshots of the listing"
                    onChange={(e) => {
                      const files = [...(e.target.files ?? [])];
                      e.target.value = "";
                      if (files.length) void addShots(files);
                    }}
                  />
                </div>

                {note ? (
                  <p
                    role={note.tone === "error" ? "alert" : "status"}
                    className={cn(
                      "mx-5 mt-5 rounded-[18px] px-4 py-3 text-sm",
                      note.tone === "error" ? "bg-sunset-100 font-semibold text-danger" : "bg-sunset-100 text-sunset-900"
                    )}
                  >
                    {note.text}
                    {note.tone === "fallback" && draft.url ? <span className="mt-1 block font-semibold text-glass-800">The link is kept on the place.</span> : null}
                  </p>
                ) : null}

                {/* Sand meets sea. */}
                <div className="relative mt-6 flex items-center gap-3 bg-sea-800 px-5 pb-5 pt-8 [--wave-sand:var(--color-shell-deep)] max-sm:flex-col max-sm:items-stretch">
                  <span aria-hidden="true" className="corral-wave-top absolute inset-x-0 top-0 h-3.5" />
                  <button
                    type="button"
                    onClick={() => void roundUp()}
                    disabled={!canRead}
                    className="inline-flex h-[52px] shrink-0 items-center justify-center gap-2.5 rounded-full bg-sunset-300 pl-4 pr-6 font-display text-lg text-tar transition hover:bg-sunset-200 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <LassoIcon className="h-6 w-6" />
                    Round it up
                  </button>
                </div>
              </section>
            </div>

            <div className="my-6 flex items-center gap-3 font-display text-[15px] text-sunset-800">
              <span aria-hidden="true" className="flex-1 border-t-[3px] border-dashed border-sunset-600/45" />
              nothing to paste?
              <span aria-hidden="true" className="flex-1 border-t-[3px] border-dashed border-sunset-600/45" />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <ChoiceButton
                art={<AddressArt />}
                title="Start from an address"
                onClick={() => startBy("address")}
              />
              <ChoiceButton
                art={<HandArt />}
                title="Fill it in by hand"
                onClick={() => startBy("title")}
              />
            </div>
          </div>
          )}
        </div>
      ) : (
        <form onSubmit={(e) => void save(e)} noValidate className="flex h-full flex-col">
          <div className="flex shrink-0 items-center gap-3 px-5 pb-3 pt-5 sm:px-8">
            <button
              type="button"
              onClick={() => setStep("capture")}
              aria-label="Back to round it up"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-shell-mid transition hover:bg-shell-deep"
            >
              <ArrowLeft className="h-5 w-5" strokeWidth={2.75} aria-hidden="true" />
            </button>
            <div className="min-w-0 flex-1">
              <h2 id={`${id}-heading`} className="font-display text-[24px] leading-tight sm:text-[26px]">
                {found && found.count > 0 ? "Check what Corral found" : "Fill in what you know"}
              </h2>
            </div>
            <button
              type="button"
              onClick={() => ref.current?.close()}
              aria-label="Close"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition hover:bg-shell-mid"
            >
              <X className="h-5 w-5" strokeWidth={2.75} aria-hidden="true" />
            </button>
          </div>

          <div className={cn("min-h-0 flex-1 space-y-4 overflow-y-auto px-5 pb-6 sm:px-8", entering && "corral-enter")} onAnimationEnd={(e) => e.target === e.currentTarget && setEntering(false)}>
            {found ? (
              <div className="flex items-center gap-4 rounded-[22px] bg-shell-deep px-4 py-3.5">
                {found.count > 0 ? <FenceCount n={found.count} /> : <FenceCount n={0} />}
                <p className="min-w-0 flex-1 font-display text-[18px] leading-snug">
                  {found.count > 0 ? `Rounded up ${found.count} ${found.count === 1 ? "detail" : "details"}` : "Not much to round up"} from{" "}
                  {draft.url ? (
                    <a href={draft.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 text-sea-700 underline decoration-2 underline-offset-4">
                      {found.from}
                      <ArrowUpRight className="h-4 w-4" strokeWidth={3} aria-hidden="true" />
                    </a>
                  ) : shots.length ? (
                    <button type="button" onClick={() => setViewing(0)} className="text-sea-700 underline decoration-2 underline-offset-4">
                      {found.from}
                    </button>
                  ) : (
                    found.from
                  )}
                </p>
                {found.count > 0 && FACT_KEYS.some((k) => k !== "leaseEnd" && draft[k].trim() === "") ? (
                  <span className="hidden shrink-0 items-center gap-1.5 rounded-full border-2 border-dashed border-sunset-600/70 px-3 py-1 text-[13px] font-semibold text-sunset-800 sm:inline-flex">
                    {found.rentMissing ? "Rent not listed" : "Not listed"}
                  </span>
                ) : null}
              </div>
            ) : null}

            {/* The place itself: photo, name, where it is. */}
            <div className="flex flex-col gap-4 rounded-[26px] bg-shell-light p-3 sm:flex-row">
              <div className="relative h-[150px] shrink-0 overflow-hidden rounded-[20px] bg-shell-deep sm:h-[132px] sm:w-[188px]">
                {pinned ? (
                  <StreetPhoto lat={pinned.lat} lng={pinned.lng} label={draft.title || address} size="card" enabled={streetPhotos} attribution="tiny" hint className="h-full w-full" />
                ) : (
                  <FenceFallback text={address ? "Finding the street…" : "Add the address to see the street"} />
                )}
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-2.5 px-1 pb-1">
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
                  <p className="mt-1.5 text-xs">
                    {commute ? (
                      <span className="rounded-full bg-glass-200 px-2.5 py-0.5 font-bold text-glass-800">Pinned · {commute.bikeMin} min bike to campus</span>
                    ) : findingPin ? (
                      <span className="text-stone-700">Finding it on the map…</span>
                    ) : address ? (
                      <span className="text-stone-700">Not on the map yet. You can drop the pin later.</span>
                    ) : null}
                  </p>
                </div>
              </div>
            </div>

            {/* The facts. Found ones wear the sun; missing ones are roped off. */}
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
              <Tile className="col-span-2 sm:col-span-1" found={filled.has("rent")} roped={roped("rent")} labelFor={`${id}-rent`} label="Rent for the whole place">
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
                {each ? (
                  <p className="mt-1 text-xs font-semibold text-stone-800">
                    {formatRent(each)} each for {people} of you
                    {budgetPerPersonCents ? (
                      <span className={each <= budgetPerPersonCents ? "text-glass-800" : "text-sunset-800"}>
                        {each <= budgetPerPersonCents ? " · within budget" : " · over budget"}
                      </span>
                    ) : null}
                  </p>
                ) : null}
                <FieldError id={`${id}-rent-error`} text={errors.rent} />
              </Tile>
              <Tile found={filled.has("beds")} roped={roped("beds")} labelFor={`${id}-beds`} label="Bedrooms">
                <Stepper inputProps={{ ...field("beds"), inputMode: "numeric" }} zeroLabel="Studio" onValue={set("beds")} less="One fewer bedroom" more="One more bedroom" onStep={(d) => step1("beds", d)} />
                <FieldError id={`${id}-beds-error`} text={errors.beds} />
              </Tile>
              <Tile found={filled.has("baths")} roped={roped("baths")} labelFor={`${id}-baths`} label="Bathrooms">
                <Stepper inputProps={{ ...field("baths"), inputMode: "decimal" }} less="Half a bathroom fewer" more="Half a bathroom more" onStep={(d) => step1("baths", d / 2)} />
                <FieldError id={`${id}-baths-error`} text={errors.baths} />
              </Tile>
              <Tile className="col-span-2 sm:col-span-1" found={filled.has("leaseStart") || filled.has("leaseEnd")} roped={roped("leaseStart") && roped("leaseEnd")} label="Lease">
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
              <Tile className="col-span-2 sm:col-span-1" found={filled.has("laundry")} roped={roped("laundry")} label="Laundry">
                <Choices name={`${id}-laundry`} label="Laundry" value={draft.laundry} options={LAUNDRY_OPTIONS.map((o) => [o, LAUNDRY_LABELS[o]])} onChange={set("laundry")} />
              </Tile>
              <Tile className="col-span-2 sm:col-span-1" found={filled.has("parking")} roped={roped("parking")} label="Parking">
                <Choices name={`${id}-parking`} label="Parking" value={draft.parking} options={PARKING_OPTIONS.map((o) => [o, PARKING_LABELS[o]])} onChange={set("parking")} />
              </Tile>
            </div>

            {offered.length ? (
              <ListingPhotos
                offered={offered}
                picked={picked}
                room={Math.max(0, MAX_PHOTOS_PER_PLACE - pics.length)}
                onToggle={(src) => setPicked((p) => (p.includes(src) ? p.filter((x) => x !== src) : [...p, src]))}
              />
            ) : null}

            <div className="rounded-[22px] bg-shell-light p-4">
              <label htmlFor={`${id}-url`} className="text-xs font-bold text-stone-700">
                Listing link
              </label>
              <input
                {...field("url")}
                type="url"
                inputMode="url"
                placeholder="https://"
                className="mt-1 h-10 w-full rounded-full border border-divider bg-shell px-4 text-sm outline-none focus-visible:border-sunset-500"
              />
              <FieldError id={`${id}-url-error`} text={errors.url} />

              <div className="mt-3 flex flex-wrap gap-2">
                {canAddPhotos ? (
                  <button
                    type="button"
                    onClick={() => picInput.current?.click()}
                    className="inline-flex h-10 items-center gap-1.5 rounded-full border border-divider bg-shell px-4 text-sm font-semibold hover:bg-shell-mid"
                  >
                    <Plus className="h-4 w-4" strokeWidth={2.75} aria-hidden="true" />
                    {pics.length ? "More photos" : "Your photos"}
                  </button>
                ) : null}
                {!notesOpen && !draft.notes ? (
                  <button
                    type="button"
                    onClick={() => setNotesOpen(true)}
                    className="inline-flex h-10 items-center gap-1.5 rounded-full border border-divider bg-shell px-4 text-sm font-semibold hover:bg-shell-mid"
                  >
                    <Plus className="h-4 w-4" strokeWidth={2.75} aria-hidden="true" />A note
                  </button>
                ) : null}
              </div>

              {canAddPhotos ? (
                <>
                  {pics.length ? (
                    <ul aria-label="Photos to add" className="mt-3 flex flex-wrap gap-2.5">
                      {pics.map((p, i) => (
                        <li key={p.id} className="relative">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={p.url} alt={`Photo ${i + 1} to add`} className="h-16 w-16 rounded-2xl border border-divider object-cover" />
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
                    </ul>
                  ) : null}
                  {picNote ? <p className="mt-2 text-xs font-semibold text-danger">{picNote}</p> : null}
                  <input
                    ref={picInput}
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
                </>
              ) : null}

              {notesOpen || draft.notes ? (
                <div className="mt-3">
                  <label htmlFor={`${id}-notes`} className="text-xs font-bold text-stone-700">
                    Notes
                  </label>
                  <textarea
                    {...field("notes")}
                    rows={3}
                    maxLength={2000}
                    autoFocus={notesOpen && !draft.notes}
                    placeholder="Anything the group should know: vibe, noise, landlord, deposit…"
                    className="mt-1 w-full rounded-[16px] border border-divider bg-shell px-3.5 py-2.5 text-sm outline-none focus-visible:border-sunset-500"
                  />
                </div>
              ) : null}
            </div>

            {formError ? (
              <p role="alert" className="rounded-[16px] bg-sunset-100 px-4 py-3 text-sm font-semibold text-danger">
                {formError}
              </p>
            ) : null}
          </div>

          <div className="flex shrink-0 items-center gap-3 border-t border-divider bg-shell-deep px-5 py-3.5 sm:px-8">
            <span className="hidden flex-1 sm:block" />
            <button type="button" onClick={() => setStep("capture")} className="h-12 rounded-full px-4 text-[15px] font-semibold text-stone-800 hover:bg-shell-mid max-sm:flex-1">
              Back
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex h-[52px] items-center justify-center gap-2 rounded-full bg-sunset-500 px-6 font-display text-lg text-tar shadow-sm transition hover:bg-sunset-400 disabled:opacity-60 max-sm:flex-[2]"
            >
              <FenceIcon className="h-5 w-5" />
              {saving ? "Adding…" : "Into the corral"}
            </button>
          </div>
        </form>
      )}
      {viewing !== null && shots[viewing] ? (
        <ScreenshotViewer url={shots[viewing].url} index={viewing} count={shots.length} onClose={() => setViewing(null)} />
      ) : null}
    </dialog>
  );
}

function ChoiceButton({ art, title, onClick }: { art: React.ReactNode; title: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="group flex items-center gap-3.5 rounded-[22px] border border-divider bg-shell-light p-3 text-left transition hover:bg-shell-mid">
      {art}
      <span className="min-w-0 font-display text-[17px] leading-tight">{title}</span>
    </button>
  );
}

/** While Corral reads: the sun sets behind the corral as the fence goes up, board by board. */
function RoundingUp({ what, landed, onStop }: { what: string; landed: number | null; onStop: () => void }) {
  const done = landed !== null;
  return (
    <div role="status" aria-live="polite" className="flex min-h-[360px] flex-1 flex-col items-center justify-center px-6 py-10 text-center">
      <div aria-hidden="true" className="relative h-[150px] w-[260px] overflow-hidden rounded-[28px] bg-sunset-300">
        <span className={cn("absolute left-1/2 h-24 w-24 -translate-x-1/2 rounded-full bg-sunset-100", done ? "top-[70px] transition-[top] duration-700 ease-in" : "corral-sunset-big")} />
        <span className="absolute inset-x-0 bottom-[34px] flex items-end justify-center gap-[6px]">
          {[34, 44, 30, 40, 48, 32, 42].map((h, i) => (
            <span
              key={i}
              className={cn(
                "block w-[14px] origin-bottom rounded-t-full rounded-b-[2px]",
                done ? "corral-board-in" : "corral-board",
                ["bg-sea-700", "bg-sunset-500", "bg-glass-500", "bg-sea-300", "bg-sunset-600", "bg-sea-700", "bg-glass-600"][i]
              )}
              style={{ height: h, animationDelay: done ? `${i * 0.06}s` : `${i * 0.18}s` }}
            />
          ))}
        </span>
        <span className="corral-stripe absolute inset-x-0 bottom-0 h-[34px]" />
      </div>
      <p className="mt-6 font-display text-[26px] leading-tight">
        {done ? (landed ? `Rounded up ${landed} ${landed === 1 ? "detail" : "details"}` : "Not much to round up") : "Rounding it up…"}
      </p>
      <p className={cn("mt-1.5 text-[15px] text-stone-800", done && "invisible")}>Reading {what}</p>
      <button type="button" onClick={onStop} className={cn("mt-6 h-11 rounded-full px-5 text-[15px] font-semibold text-stone-800 hover:bg-shell-mid", done && "invisible")}>
        Stop
      </button>
    </div>
  );
}

/**
 * After "Into the corral": the place's photo drops in behind the fence as the
 * sun finishes setting. Settles onto the board by itself unless you reach for
 * one of the buttons.
 */
function IntoTheCorral({
  name,
  photo,
  pin,
  streetPhotos,
  onSee,
  onAnother
}: {
  name: string;
  photo: string | null;
  pin: { lat: number; lng: number } | null;
  streetPhotos: boolean;
  onSee: () => void;
  onAnother?: () => void;
}) {
  const [stay, setStay] = useState(false);
  useEffect(() => {
    if (stay) return;
    const t = window.setTimeout(onSee, 4200);
    return () => window.clearTimeout(t);
  }, [stay, onSee]);
  return (
    <div
      role="status"
      aria-live="polite"
      onPointerMove={() => setStay(true)}
      onKeyDown={() => setStay(true)}
      className="flex h-full flex-col items-center justify-center px-6 py-10 text-center"
    >
      <div aria-hidden="true" className="relative h-[210px] w-[320px] overflow-hidden rounded-[30px] bg-sunset-300">
        <span className="corral-sunset-settle absolute left-1/2 h-28 w-28 -translate-x-1/2 rounded-full bg-sunset-100" />
        <span className="corral-drop absolute left-1/2 top-[34px] h-[92px] w-[132px] overflow-hidden rounded-[14px] border-4 border-shell-light bg-shell-deep shadow-[0_8px_18px_rgb(32_30_29/0.22)]">
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photo} alt="" className="h-full w-full object-cover" />
          ) : pin ? (
            <StreetPhoto lat={pin.lat} lng={pin.lng} label={name} size="card" enabled={streetPhotos} attribution="tiny" className="h-full w-full" />
          ) : (
            <FenceFallback />
          )}
        </span>
        <span className="absolute inset-x-0 bottom-[38px] flex items-end justify-center gap-[6px]">
          {[30, 40, 26, 36, 44, 28, 38, 32, 42].map((h, i) => (
            <span
              key={i}
              className={cn("corral-board-in block w-[14px] origin-bottom rounded-t-full rounded-b-[2px]", ["bg-sea-700", "bg-sunset-500", "bg-glass-500", "bg-sea-300", "bg-sunset-600"][i % 5])}
              style={{ height: h, animationDelay: `${0.35 + i * 0.05}s` }}
            />
          ))}
        </span>
        <span className="corral-stripe absolute inset-x-0 bottom-0 h-[38px]" />
      </div>
      <p className="mt-7 font-display text-[28px] leading-tight">{name} is in the corral</p>
      <div className="mt-7 flex flex-wrap justify-center gap-3">
        <button type="button" autoFocus onClick={onSee} className="inline-flex h-[52px] items-center gap-2 rounded-full bg-sunset-500 px-6 font-display text-lg text-tar hover:bg-sunset-400">
          <FenceIcon className="h-5 w-5" />
          See it on the board
        </button>
        {onAnother ? (
          <button type="button" onClick={onAnother} className="inline-flex h-[52px] items-center gap-2 rounded-full border border-divider bg-shell-light px-6 font-display text-lg text-tar hover:bg-shell-mid">
            <LassoIcon className="h-5 w-5" />
            Round up another
          </button>
        ) : null}
      </div>
    </div>
  );
}

/** Download the listing photos the person picked, in the order they picked them. Ones that fail are skipped. */
/** Download the picked listing photos through Corral's server; failed ones are left out. */
async function fetchPicked(urls: string[]): Promise<{ src: string; file: File }[]> {
  const files = await Promise.all(
    urls.map(async (src, i) => {
      try {
        const res = await fetch(`/api/listing-photo?url=${encodeURIComponent(src)}`);
        if (!res.ok) return null;
        const blob = await res.blob();
        return { src, file: new File([blob], `listing-photo-${i + 1}`, { type: blob.type || "image/jpeg" }) };
      } catch {
        return null;
      }
    })
  );
  return files.filter((f): f is { src: string; file: File } => f !== null);
}

/**
 * The listing's own photos, offered, none chosen. Tap to keep one; the first
 * one picked leads (the cover). Picked ones are numbered on little fence boards.
 */
function ListingPhotos({ offered, picked, room, onToggle }: { offered: string[]; picked: string[]; room: number; onToggle: (src: string) => void }) {
  const [broken, setBroken] = useState<string[]>([]);
  const shown = offered.filter((src) => !broken.includes(src));
  if (!shown.length) return null;
  return (
    <section aria-label="Photos from the listing" className="rounded-[22px] bg-shell-light p-4">
      <h3 className="font-display text-[17px]">Keep any photos from the listing?</h3>
      <ul className="mt-3 flex gap-2.5 overflow-x-auto pb-1">
        {shown.map((src, i) => {
          const n = picked.indexOf(src) + 1;
          const full = !n && picked.length >= room;
          return (
            <li key={src} className="shrink-0">
              <button
                type="button"
                aria-pressed={n > 0}
                aria-label={n ? `Photo ${i + 1} from the listing, kept${n === 1 ? " as the cover" : ""}` : `Keep photo ${i + 1} from the listing`}
                disabled={full}
                onClick={() => onToggle(src)}
                className={cn(
                  "relative block h-[84px] w-[112px] overflow-hidden rounded-[14px] transition disabled:opacity-40",
                  n ? "ring-[3px] ring-sunset-500 ring-offset-2 ring-offset-shell-light" : "opacity-80 hover:opacity-100"
                )}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setBroken((b) => [...b, src])} className="h-full w-full object-cover" />
                {n ? (
                  <span aria-hidden="true" className="absolute left-1.5 top-1.5 flex h-7 min-w-6 items-start justify-center rounded-t-full rounded-b-[3px] bg-sunset-500 px-1.5 pt-1 font-display text-[13px] leading-none text-tar">
                    {n}
                  </span>
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** One little fence board per detail found, rising in one after another. */
function FenceCount({ n }: { n: number }) {
  const colors = ["bg-sea-700", "bg-sunset-500", "bg-glass-500", "bg-sea-300", "bg-sunset-600"];
  const heights = [26, 32, 22, 30, 34, 24, 28, 33, 25];
  return (
    <span role="img" aria-label={`${n} ${n === 1 ? "detail" : "details"} found`} className="flex h-9 shrink-0 items-end gap-[3px]">
      {n === 0 ? (
        <span className="block h-7 w-[9px] rounded-t-full rounded-b-[2px] border-2 border-dashed border-sunset-600/70" />
      ) : (
        Array.from({ length: Math.min(n, 9) }, (_, i) => (
          <span
            key={i}
            className={cn("corral-board-in block w-[9px] origin-bottom rounded-t-full rounded-b-[2px]", colors[i % colors.length])}
            style={{ height: heights[i % heights.length], animationDelay: `${0.15 + i * 0.07}s` }}
          />
        ))
      )}
    </span>
  );
}

function reducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** A pin standing on the horizon at sunset. */
function AddressArt() {
  return (
    <span aria-hidden="true" className="relative block h-14 w-14 shrink-0 overflow-hidden rounded-[18px] bg-sunset-300">
      <span className="absolute left-1/2 top-4 h-9 w-9 -translate-x-1/2 rounded-full bg-sunset-100" />
      <span className="corral-stripe absolute inset-x-0 bottom-0 h-3.5" />
      <svg viewBox="0 0 24 24" className="absolute bottom-2 left-1/2 h-8 w-8 -translate-x-1/2 transition group-hover:-translate-y-0.5">
        <path d="M12 22s-7-6.4-7-11.7a7 7 0 0 1 14 0C19 15.6 12 22 12 22z" fill="#0b4163" />
        <circle cx="12" cy="10" r="2.6" fill="#fff2eb" />
      </svg>
    </span>
  );
}

/** Two fence boards up, and a dashed one still to fill in. */
function HandArt() {
  return (
    <span aria-hidden="true" className="flex h-14 w-14 shrink-0 items-end justify-center gap-[5px] rounded-[18px] bg-shell-deep pb-2">
      <span className="h-8 w-[9px] rounded-t-full rounded-b-[2px] bg-sea-700" />
      <span className="h-10 w-[9px] rounded-t-full rounded-b-[2px] bg-sunset-500" />
      <span className="h-9 w-[9px] rounded-t-full rounded-b-[2px] border-2 border-dashed border-glass-600 transition group-hover:bg-glass-300" />
    </span>
  );
}

/** One fact. Found by Corral: sunset tint and a sun mark. Missing from what was read: roped off. */
function Tile({
  label,
  labelFor,
  found,
  roped,
  className,
  children
}: {
  label: string;
  labelFor?: string;
  found: boolean;
  roped: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const Label = labelFor ? "label" : "p";
  return (
    <div
      className={cn(
        "min-w-0 rounded-[20px] p-3",
        found ? "border-[1.5px] border-sunset-400 bg-sunset-100" : roped ? "border-2 border-dashed border-sunset-600/70 bg-transparent" : "border border-divider bg-shell-light",
        className
      )}
    >
      <Label {...(labelFor ? { htmlFor: labelFor } : {})} className="mb-1.5 flex items-center justify-between gap-2 text-xs font-bold text-stone-800">
        {label}
        {found ? <SunMark className="h-4 w-4" label="Rounded up from the listing" /> : roped ? <span className="sr-only">Not in the listing</span> : null}
      </Label>
      {children}
    </div>
  );
}

function Stepper({
  inputProps,
  less,
  more,
  onStep,
  zeroLabel,
  onValue
}: {
  inputProps: React.InputHTMLAttributes<HTMLInputElement>;
  less: string;
  more: string;
  onStep: (delta: number) => void;
  /** Shown instead of 0 ("Studio"); typing it back in means 0. */
  zeroLabel?: string;
  onValue?: (v: string) => void;
}) {
  const zero = zeroLabel && inputProps.value === "0";
  const input = zeroLabel
    ? {
        ...inputProps,
        inputMode: "text" as const,
        value: zero ? zeroLabel : inputProps.value,
        onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
          const t = e.target.value.trim();
          onValue?.(new RegExp(`^${zeroLabel}$`, "i").test(t) ? "0" : t.replace(/[^0-9.]/g, ""));
        }
      }
    : inputProps;
  return (
    <div className="flex items-center justify-between gap-1">
      <button type="button" onClick={() => onStep(-1)} aria-label={less} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-divider bg-shell-light hover:bg-shell-mid">
        <Minus className="h-4 w-4" strokeWidth={2.75} aria-hidden="true" />
      </button>
      <input {...input} placeholder="?" className={cn("w-12 min-w-0 flex-1 border-0 bg-transparent text-center font-display tabular-nums outline-none placeholder:text-stone-500", zero ? "text-lg" : "text-[22px]")} />
      <button type="button" onClick={() => onStep(1)} aria-label={more} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-divider bg-shell-light hover:bg-shell-mid">
        <Plus className="h-4 w-4" strokeWidth={2.75} aria-hidden="true" />
      </button>
    </div>
  );
}

/** A small set of choices as chips; "Not sure" leaves it unknown. */
function Choices({
  name,
  label,
  value,
  options,
  onChange
}: {
  name: string;
  label: string;
  value: string;
  options: [string, string][];
  onChange: (v: string) => void;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1.5">
      {[...options, ["", "Not sure"] as [string, string]].map(([v, text]) => (
        <label
          key={v || "unknown"}
          className={cn(
            "inline-flex h-9 cursor-pointer items-center rounded-full px-3 text-[13px] transition has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-focus",
            value === v ? "bg-sea-800 font-semibold text-shell" : "border border-divider bg-shell-light text-tar hover:bg-shell-mid"
          )}
        >
          <input type="radio" name={name} value={v} checked={value === v} onChange={() => onChange(v)} className="sr-only" />
          {text}
        </label>
      ))}
    </div>
  );
}

function FieldError({ id, text }: { id: string; text?: string }) {
  return text ? (
    <p id={id} className="mt-1 text-xs font-semibold text-danger">
      {text}
    </p>
  ) : null;
}
