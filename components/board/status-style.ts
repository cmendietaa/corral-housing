import type { ListingStatus } from "@/lib/listing";

// Plain constants (no "use client") so server components like the landing preview can read them.

/** Literal class strings so Tailwind can see them. */
export const STATUS_STYLES: Record<ListingStatus, { chip: string; dot: string }> = {
  considering: { chip: "bg-st-considering-bg text-st-considering", dot: "bg-st-considering-dot" },
  contacted: { chip: "bg-st-contacted-bg text-st-contacted", dot: "bg-st-contacted-dot" },
  tour_scheduled: { chip: "bg-st-tour-bg text-st-tour", dot: "bg-st-tour-dot" },
  applied: { chip: "bg-st-applied-bg text-st-applied", dot: "bg-st-applied-dot" },
  passed: { chip: "bg-st-closed-bg text-st-closed", dot: "bg-st-closed-dot" },
  unavailable: { chip: "bg-st-closed-bg text-st-closed", dot: "bg-st-closed-dot" }
};

/** Map rent tags are filled with the status chip colors (MapLibre markers can't use classes). */
export const STATUS_TAG: Record<ListingStatus, { bg: string; fg: string }> = {
  considering: { bg: "#dcd3c4", fg: "#2e2b25" },
  contacted: { bg: "#ffe1d0", fg: "#643312" },
  tour_scheduled: { bg: "#e1eecc", fg: "#3d472b" },
  applied: { bg: "#5f6c47", fg: "#f9f4ed" },
  passed: { bg: "#eee7db", fg: "#645c50" },
  unavailable: { bg: "#eee7db", fg: "#645c50" }
};

/** Crew colors for roommates, in member order: Maya, Jordan, Sam, Priya, then repeating. */
export const CREW = [
  { bg: "bg-sunset-400", fg: "text-sunset-900" },
  { bg: "bg-sea-500", fg: "text-[#f9f4ed]" },
  { bg: "bg-glass-500", fg: "text-glass-900" },
  { bg: "bg-sea-200", fg: "text-sea-900" }
] as const;
