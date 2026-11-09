import type { ListingStatus } from "@/lib/listing";

// Plain constants (no "use client") so server components like the landing preview can read them.

/** Literal class strings so Tailwind can see them. */
export const STATUS_STYLES: Record<ListingStatus, { chip: string; dot: string; edge: string }> = {
  considering: { chip: "bg-st-considering-bg text-st-considering", dot: "bg-st-considering", edge: "before:bg-st-considering" },
  contacted: { chip: "bg-st-contacted-bg text-st-contacted", dot: "bg-st-contacted", edge: "before:bg-st-contacted" },
  tour_scheduled: { chip: "bg-st-tour-bg text-st-tour", dot: "bg-st-tour", edge: "before:bg-st-tour" },
  applied: { chip: "bg-st-applied-bg text-st-applied", dot: "bg-st-applied", edge: "before:bg-st-applied" },
  passed: { chip: "bg-st-closed-bg text-st-closed", dot: "bg-st-closed", edge: "before:bg-st-closed" },
  unavailable: { chip: "bg-st-closed-bg text-st-closed", dot: "bg-st-closed", edge: "before:bg-st-closed" }
};

/**
 * Hex values for places that can't use classes (map tags). These match the
 * darker chip-text tokens in globals.css so white tag text stays above 4.5:1.
 */
export const STATUS_HEX: Record<ListingStatus, string> = {
  considering: "#546876",
  contacted: "#1f5f8b",
  tour_scheduled: "#8a5e10",
  applied: "#3f7552",
  passed: "#6e6e69",
  unavailable: "#6e6e69"
};
