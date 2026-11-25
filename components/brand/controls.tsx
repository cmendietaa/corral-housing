"use client";

import { cn } from "@/lib/utils";
import { LassoIcon } from "./motifs";

/**
 * Corral-styled controls. Each one keeps a familiar meaning (a toggle with a
 * label, a button that says what it does); the motif is the shape, not a riddle.
 */

/** Compare: rope a place in (up to three). A checkbox named "Compare <place>", labelled "Rope in" / "Roped in" on screen. */
export function RopeInToggle({
  on,
  disabled,
  label,
  onToggle,
  className
}: {
  on: boolean;
  disabled?: boolean;
  /** The place's name, for the accessible name "Compare <name>". */
  label: string;
  onToggle: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={on}
      aria-label={`Compare ${label}`}
      disabled={disabled}
      onClick={onToggle}
      title={disabled ? "You can compare up to 3 places" : undefined}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full text-sm font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:cursor-not-allowed disabled:opacity-50",
        on ? "text-sea-700" : "text-stone-700 hover:text-tar",
        className
      )}
    >
      <span className={cn("flex h-7 w-7 items-center justify-center rounded-full", on ? "bg-sea-100" : "")}>
        <LassoIcon className={cn("h-5 w-5", on ? "" : "[&_path]:[stroke-dasharray:3_3]")} strokeWidth={2.2} />
      </span>
      <span aria-hidden="true">{on ? "Roped in" : "Rope in"}</span>
    </button>
  );
}

/** The rent-tag shape as a button: a knot on the left, rounded on the right. */
export function RopeTagButton({
  children,
  className,
  knotClassName,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { knotClassName?: string }) {
  return (
    <button
      type="button"
      {...props}
      className={cn(
        "inline-flex h-9 items-center gap-2 rounded-l-[10px] rounded-r-[18px] pl-2.5 pr-4 text-[13px] font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus",
        className
      )}
    >
      <span aria-hidden="true" className={cn("h-[7px] w-[7px] shrink-0 rounded-full bg-shell-light", knotClassName)} />
      {children}
    </button>
  );
}
