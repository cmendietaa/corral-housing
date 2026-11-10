import { cn } from "@/lib/utils";

/**
 * Corral's mark: three surfboards in a corral, tied with a rope.
 * From the v2 handoff (assets/corral-mark.svg and corral-mark-reversed.svg).
 * Below 32px the rope is dropped (see app/icon.svg).
 */
export function CorralMark({ className, reversed = false }: { className?: string; reversed?: boolean }) {
  const boards = reversed ? ["#97cceb", "#f6a06b", "#ccdbb2"] : ["#1c5b82", "#b2622d", "#728157"];
  const rope = reversed ? "#fdf2ea" : "#201e1d";
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true" className={cn("h-[38px] w-[38px] shrink-0", className)}>
      <rect x="7" y="9" width="9" height="31" rx="4.5" fill={boards[0]} />
      <rect x="19.5" y="4" width="9" height="36" rx="4.5" fill={boards[1]} />
      <rect x="32" y="12" width="9" height="28" rx="4.5" fill={boards[2]} />
      <path d="M3 25 Q24 33 45 25" fill="none" stroke={rope} strokeWidth="2.6" strokeLinecap="round" />
    </svg>
  );
}

/** The mark beside the lowercase wordmark "corral". */
export function Wordmark({ className, size = "md" }: { className?: string; size?: "sm" | "md" }) {
  return (
    <span className={cn("flex items-center gap-1.5", className)}>
      <CorralMark className={size === "sm" ? "h-[30px] w-[30px]" : undefined} />
      <span
        className={cn(
          "font-display leading-none tracking-[-0.02em] text-tar",
          size === "sm" ? "text-[21px]" : "text-[26px]"
        )}
      >
        corral
      </span>
    </span>
  );
}
