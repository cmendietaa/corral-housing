"use client";

import { useEffect, useId, useRef, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { streetHeadline } from "@/lib/address";
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
    url: l.url,
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
};

export function ListingForm({ open, listing, onClose, onSubmit, onDelete }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const id = useId();
  const base = listing ?? emptyListingInput();
  const [draft, setDraft] = useState<Draft>(() => toDraft(base));
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const set = (key: keyof Draft) => (value: string) => setDraft((d) => ({ ...d, [key]: value }));

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
      url: draft.url.trim(),
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
            Only the link and a name are required. Leave anything you don&apos;t know blank and it shows as
            unknown.
          </p>
        </div>

        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-5 pb-6 pt-5 sm:px-7">
          <Section title="The place">
            <Field label="Listing link" htmlFor={`${id}-url`} error={errors.url} errorId={`${id}-url-error`} required wide>
              <Input {...field("url")} type="url" inputMode="url" autoFocus placeholder="https://" required />
            </Field>
            <Field
              label="Name"
              htmlFor={`${id}-title`}
              error={errors.title}
              errorId={`${id}-title-error`}
              hint="A nickname the group will recognize"
              required
              wide
            >
              <Input {...field("title")} maxLength={120} placeholder="Upstairs 4-bed with a balcony" required />
            </Field>
            <Field label="Address" htmlFor={`${id}-address`} error={errors.address} errorId={`${id}-address-error`} wide>
              <Input {...field("address")} maxLength={200} placeholder="6512 Sabado Tarde Rd" />
            </Field>
          </Section>

          <Section title="Rent and size">
            <Field
              label="Rent for the whole place"
              htmlFor={`${id}-rent`}
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
            <Field label="Beds" htmlFor={`${id}-beds`} error={errors.beds} errorId={`${id}-beds-error`}>
              <Input {...field("beds")} inputMode="numeric" placeholder="4" />
            </Field>
            <Field label="Baths" htmlFor={`${id}-baths`} error={errors.baths} errorId={`${id}-baths-error`}>
              <Input {...field("baths")} inputMode="decimal" placeholder="2" />
            </Field>
          </Section>

          <Section title="Lease">
            <Field label="Starts" htmlFor={`${id}-leaseStart`} error={errors.leaseStart} errorId={`${id}-leaseStart-error`}>
              <Input {...field("leaseStart")} type="date" />
            </Field>
            <Field label="Ends" htmlFor={`${id}-leaseEnd`} error={errors.leaseEnd} errorId={`${id}-leaseEnd-error`}>
              <Input {...field("leaseEnd")} type="date" />
            </Field>
          </Section>

          <Section title="Extras">
            <Field label="Parking" htmlFor={`${id}-parking`}>
              <Select {...field("parking")}>
                <option value="">Don&apos;t know yet</option>
                {PARKING_OPTIONS.map((p) => (
                  <option key={p} value={p}>
                    {PARKING_LABELS[p]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Laundry" htmlFor={`${id}-laundry`}>
              <Select {...field("laundry")}>
                <option value="">Don&apos;t know yet</option>
                {LAUNDRY_OPTIONS.map((p) => (
                  <option key={p} value={p}>
                    {LAUNDRY_LABELS[p]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Notes" htmlFor={`${id}-notes`} wide>
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
  children
}: {
  label: string;
  htmlFor: string;
  error?: string;
  errorId?: string;
  hint?: string;
  required?: boolean;
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("min-w-0", wide && "sm:col-span-2")}>
      <label htmlFor={htmlFor} className="mb-1 flex flex-wrap items-baseline gap-x-1.5 text-sm font-semibold text-ink">
        {label}
        {required ? <span className="text-xs font-medium text-ocean">required</span> : null}
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
