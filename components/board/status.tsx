"use client";

import { ChevronDown } from "lucide-react";
import { LISTING_STATUSES, STATUS_LABELS, type ListingStatus } from "@/lib/listing";
import { cn } from "@/lib/utils";

/** Literal class strings so Tailwind can see them. */
export const STATUS_STYLES: Record<ListingStatus, { chip: string; dot: string; edge: string }> = {
  considering: { chip: "bg-st-considering-bg text-st-considering", dot: "bg-st-considering", edge: "before:bg-st-considering" },
  contacted: { chip: "bg-st-contacted-bg text-st-contacted", dot: "bg-st-contacted", edge: "before:bg-st-contacted" },
  tour_scheduled: { chip: "bg-st-tour-bg text-st-tour", dot: "bg-st-tour", edge: "before:bg-st-tour" },
  applied: { chip: "bg-st-applied-bg text-st-applied", dot: "bg-st-applied", edge: "before:bg-st-applied" },
  passed: { chip: "bg-st-closed-bg text-st-closed", dot: "bg-st-closed", edge: "before:bg-st-closed" },
  unavailable: { chip: "bg-st-closed-bg text-st-closed", dot: "bg-st-closed", edge: "before:bg-st-closed" }
};

/** Hex values for places that can't use classes (map pins). Keep in sync with globals.css. */
export const STATUS_HEX: Record<ListingStatus, string> = {
  considering: "#6b7f8e",
  contacted: "#1f5f8b",
  tour_scheduled: "#9a6b16",
  applied: "#3f7552",
  passed: "#8a8a86",
  unavailable: "#8a8a86"
};

export function StatusSelect({
  value,
  onChange,
  label,
  className
}: {
  value: ListingStatus;
  onChange: (status: ListingStatus) => void;
  /** Accessible name, e.g. "Status for Sabado Tarde 4-bed". */
  label: string;
  className?: string;
}) {
  const style = STATUS_STYLES[value];
  return (
    <span className={cn("relative inline-flex", className)}>
      <span
        aria-hidden="true"
        className={cn("pointer-events-none absolute left-2.5 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full", style.dot)}
      />
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value as ListingStatus)}
        className={cn(
          "h-8 appearance-none rounded-full pl-6 pr-7 text-xs font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
          style.chip
        )}
      >
        {LISTING_STATUSES.map((s) => (
          <option key={s} value={s}>
            {STATUS_LABELS[s]}
          </option>
        ))}
      </select>
      <ChevronDown
        aria-hidden="true"
        className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 opacity-70"
      />
    </span>
  );
}
