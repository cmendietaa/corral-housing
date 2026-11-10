"use client";

import { ChevronDown } from "lucide-react";
import { LISTING_STATUSES, STATUS_LABELS, type ListingStatus } from "@/lib/listing";
import { cn } from "@/lib/utils";
import { STATUS_STYLES } from "./status-style";

export { CREW, STATUS_STYLES, STATUS_TAG } from "./status-style";

/** A read-only status pill: 11px Figtree 600, padding 3px 10px. */
export function StatusChip({ status, className }: { status: ListingStatus; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full px-2.5 py-[3px] text-[11px] font-semibold leading-4",
        STATUS_STYLES[status].chip,
        className
      )}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}

/**
 * The status as a menu. `chip` shows the status itself ("Contacted ▾");
 * `move` is the kanban's "Move ▾" button. Native <select> underneath for
 * keyboard and phone pickers; restyled where the browser allows (.status-select).
 */
export function StatusMenu({
  value,
  onChange,
  label,
  variant = "chip",
  className
}: {
  value: ListingStatus;
  onChange: (status: ListingStatus) => void;
  /** Accessible name, e.g. "Status for Sabado Tarde, 6512". */
  label: string;
  variant?: "chip" | "move";
  className?: string;
}) {
  const move = variant === "move";
  return (
    <span className={cn("relative inline-flex", className)}>
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value as ListingStatus)}
        className={cn(
          "status-select appearance-none rounded-full pr-7 font-semibold transition",
          move
            ? // The select's own text is hidden behind the "Move" label; options keep their color.
              "h-9 w-[5.5rem] border border-divider bg-shell-light pl-4 text-[13px] text-transparent hover:bg-shell-mid [&>option]:text-tar"
            : cn("h-8 pl-3 text-xs", STATUS_STYLES[value].chip)
        )}
      >
        {LISTING_STATUSES.map((s) => (
          <option key={s} value={s} data-status={s}>
            {STATUS_LABELS[s]}
          </option>
        ))}
      </select>
      {move ? (
        <span aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[13px] font-semibold text-tar">
          Move
        </span>
      ) : null}
      <ChevronDown
        aria-hidden="true"
        strokeWidth={2.75}
        className="pointer-events-none absolute right-2.5 top-1/2 h-3 w-3 -translate-y-1/2 opacity-70"
      />
    </span>
  );
}

/** Kept for older call sites: the chip-style status menu. */
export const StatusSelect = StatusMenu;
