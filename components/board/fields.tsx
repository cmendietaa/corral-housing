"use client";

import { Minus, Plus } from "lucide-react";
import { SunMark } from "@/components/brand/motifs";
import { cn } from "@/lib/utils";

/**
 * Field pieces shared by adding and editing a place: fact tiles (found ones
 * wear the little sun, missing ones are roped off), steppers and chips.
 */

export function Tile({
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

export function Stepper({
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
      <input {...input} placeholder="?" className={cn("w-12 min-w-0 flex-1 rounded-full border-0 bg-transparent text-center font-display tabular-nums outline-none placeholder:text-stone-500 focus-visible:ring-2 focus-visible:ring-focus", zero ? "text-lg" : "text-[22px]")} />
      <button type="button" onClick={() => onStep(1)} aria-label={more} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-divider bg-shell-light hover:bg-shell-mid">
        <Plus className="h-4 w-4" strokeWidth={2.75} aria-hidden="true" />
      </button>
    </div>
  );
}

/** A small set of choices as chips; "Not sure" leaves it unknown. */
export function Choices({
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

export function FieldError({ id, text }: { id: string; text?: string }) {
  return text ? (
    <p id={id} className="mt-1 text-xs font-semibold text-danger">
      {text}
    </p>
  ) : null;
}
