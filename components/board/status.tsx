"use client";

import { ChevronDown } from "lucide-react";
import { LISTING_STATUSES, STATUS_LABELS, type ListingStatus } from "@/lib/listing";
import { STATUS_STYLES } from "./status-style";
import { cn } from "@/lib/utils";

export { STATUS_HEX, STATUS_STYLES } from "./status-style";

export function StatusSelect({
  value,
  onChange,
  label,
  className
}: {
  value: ListingStatus;
  onChange: (status: ListingStatus) => void;
  /** Accessible name, e.g. "Status for Sabado Tarde, 6512". */
  label: string;
  className?: string;
}) {
  const style = STATUS_STYLES[value];
  return (
    <span className={cn("relative inline-flex", className)}>
      <span
        aria-hidden="true"
        className={cn("pointer-events-none absolute left-2 top-1/2 h-3.5 w-1 -translate-y-1/2 rounded-full", style.dot)}
      />
      {/* Native select for accessibility and phone pickers; styled further where supported (see .status-select). */}
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value as ListingStatus)}
        className={cn(
          "status-select h-7 appearance-none rounded-[6px] pl-4.5 pr-6 text-xs font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
          style.chip
        )}
      >
        {LISTING_STATUSES.map((s) => (
          <option key={s} value={s} data-status={s}>
            {STATUS_LABELS[s]}
          </option>
        ))}
      </select>
      <ChevronDown
        aria-hidden="true"
        className="pointer-events-none absolute right-1.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 opacity-60"
      />
    </span>
  );
}
