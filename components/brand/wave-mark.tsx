import { cn } from "@/lib/utils";

/**
 * Corral's mark: a house (roof, walls, coral door) above a coral wave, on an
 * ocean-blue tile. Keep in sync with app/icon.svg, the favicon.
 */
export function WaveMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" aria-hidden="true" className={cn("h-9 w-9 shrink-0", className)}>
      <rect width="40" height="40" rx="11" fill="var(--color-ocean)" />
      <path
        d="M10 20.5 L20 12 L30 20.5"
        fill="none"
        stroke="var(--color-sand)"
        strokeWidth="2.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M13 19 V26 H27 V19" fill="none" stroke="var(--color-sand)" strokeWidth="2.8" strokeLinejoin="round" />
      <rect x="18.2" y="21" width="3.6" height="5" rx="0.8" fill="var(--color-coral)" />
      <path
        d="M7 31.5c2.6 0 3.8-2.1 6.4-2.1s3.8 2.1 6.6 2.1 3.8-2.1 6.6-2.1 3.8 2.1 6.4 2.1"
        fill="none"
        stroke="var(--color-coral)"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <WaveMark />
      <span className="font-display text-xl font-extrabold tracking-tight text-ink">Corral</span>
    </span>
  );
}
