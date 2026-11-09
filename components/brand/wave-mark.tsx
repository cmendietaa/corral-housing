import { cn } from "@/lib/utils";

/** Corral's mark: a breaking wave over a sand line, drawn to sit on a round ocean tile. */
export function WaveMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 40 40"
      aria-hidden="true"
      className={cn("h-9 w-9 shrink-0", className)}
    >
      <rect width="40" height="40" rx="12" fill="var(--color-ocean)" />
      <path
        d="M6 25c3.2 0 4.6-2.6 7.6-2.6s4.4 2.6 7.6 2.6 4.6-2.6 7.6-2.6S33 25 34 25"
        fill="none"
        stroke="var(--color-sand)"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
      <path
        d="M9 19.5c1.4-5.6 6-9 11.4-9 3.9 0 6.7 2 7.6 4.6.6 1.7-.6 3.3-2.3 3.1-2.1-.3-3.3-2.7-5.6-2.5-1.8.2-2.6 2-2.6 3.8"
        fill="none"
        stroke="var(--color-sand)"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M6 31h28" stroke="var(--color-coral)" strokeWidth="2.6" strokeLinecap="round" />
    </svg>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <WaveMark />
      <span className="text-lg font-bold tracking-tight text-ink">Corral</span>
    </span>
  );
}
