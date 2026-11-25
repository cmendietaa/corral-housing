import { cn } from "@/lib/utils";

/**
 * Corral's own visual motifs, shared so every screen speaks the same language:
 * fence boards, the setting sun, the stripe, the wave edge, the lasso and rent
 * tags. Colors come from the theme; nothing here is a stock icon.
 */

/** The five fence-board colors, in order (the same as the footer fence). */
export const FENCE_COLORS = ["bg-sea-700", "bg-sunset-500", "bg-glass-500", "bg-sea-300", "bg-sunset-300"] as const;

/** A short decorative fence: boards with round tops, slightly uneven like a real one. */
export function FenceRow({
  count = 7,
  size = "md",
  className
}: {
  count?: number;
  size?: "sm" | "md";
  className?: string;
}) {
  const heights = size === "sm" ? [16, 20, 14, 18, 22, 15, 19, 17] : [30, 38, 26, 34, 40, 28, 36, 32];
  return (
    <span aria-hidden="true" className={cn("flex items-end", size === "sm" ? "gap-[3px]" : "gap-[5px]", className)}>
      {Array.from({ length: count }, (_, i) => (
        <span
          key={i}
          className={cn("block rounded-t-full rounded-b-[2px]", size === "sm" ? "w-[7px]" : "w-[14px]", FENCE_COLORS[i % FENCE_COLORS.length])}
          style={{ height: heights[i % heights.length] }}
        />
      ))}
    </span>
  );
}

/** "Corral found this": a small sun setting into the sea. Replaces the sparkle. */
export function SunMark({ className, label }: { className?: string; label?: string }) {
  return (
    <span
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      title={label}
      className={cn("relative inline-block h-6 w-6 shrink-0 overflow-hidden rounded-full bg-sunset-300", className)}
    >
      <span className="absolute left-1/2 top-[28%] h-[55%] w-[55%] -translate-x-1/2 rounded-full bg-sunset-100" />
      <span className="absolute inset-x-0 bottom-0 h-[30%] bg-sea-700" />
    </span>
  );
}

type IconProps = { className?: string; strokeWidth?: number };

/** A rope loop with a trailing end: Corral's verb, "round it up". */
export function LassoIcon({ className, strokeWidth = 2.5 }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <path d="M13 4c4.4 0 8 2.2 8 5s-3.6 5-8 5-8-2.2-8-5 3.6-5 8-5z" />
      <path d="M8 13c-1.5 2-1.5 4 .5 5s2 3 .5 4" />
    </svg>
  );
}

/** The knot on a rope loop (drop zones). */
export function KnotIcon({ className, strokeWidth = 2.5 }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <circle cx="12" cy="9" r="3.5" />
      <path d="M10 12c-1 3-3 5-5 7M14 12c1 3 3 5 5 7" />
    </svg>
  );
}

/** Two fence boards with a rail: "into the corral". */
export function FenceIcon({ className, strokeWidth = 2.5 }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <path d="M6 21V8l2-3 2 3v13M14 21V8l2-3 2 3v13M4 11h16M4 17h16" />
    </svg>
  );
}

/** A sun sitting on the horizon. */
export function HorizonSunIcon({ className, strokeWidth = 2.5 }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <path d="M3 17h18M6.5 17a5.5 5.5 0 0 1 11 0M12 6v2M5.6 9.6 7 11M18.4 9.6 17 11M7 20.5h10" />
    </svg>
  );
}

/** A map pin for "where is it". */
export function PinIcon({ className, strokeWidth = 2.5 }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z" />
      <circle cx="12" cy="9.5" r="2.5" />
    </svg>
  );
}

/** A pencil, for filling things in by hand. */
export function PencilIcon({ className, strokeWidth = 2.5 }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
    </svg>
  );
}

/** While Corral reads: a small sun sinks into the stripe and rises again. */
export function SettingSun({ className, label = "Reading…" }: { className?: string; label?: string }) {
  return (
    <span role="status" aria-label={label} className={cn("relative inline-block h-7 w-9 shrink-0 overflow-hidden rounded-lg bg-sunset-300", className)}>
      <span className="corral-sunset absolute left-1/2 h-4 w-4 -translate-x-1/2 rounded-full bg-sunset-100" />
      <span className="corral-stripe absolute inset-x-0 bottom-0 h-2" />
    </span>
  );
}

/**
 * No photo yet: a pale sky with the sun sitting on a fence. Fills whatever
 * frame it's in (a fence-board thumbnail, a card's photo, a compare column).
 */
export function EmptyLot({ className, size = "md" }: { className?: string; size?: "sm" | "md" }) {
  const heights = size === "sm" ? [10, 13, 9, 12, 11] : [26, 32, 24, 30, 27, 33, 25, 31, 28];
  return (
    <span aria-hidden="true" className={cn("relative block h-full w-full overflow-hidden bg-sunset-200", className)}>
      <span
        className={cn(
          "absolute left-1/2 -translate-x-1/2 rounded-full bg-sunset-100",
          size === "sm" ? "bottom-[8px] h-[44%] max-h-7 w-auto aspect-square" : "bottom-[14px] h-[48%] max-h-16 w-auto aspect-square"
        )}
      />
      <span className={cn("absolute inset-x-0 bottom-0 flex items-end justify-center", size === "sm" ? "gap-[2px] px-[2px]" : "gap-[5px] px-2")}>
        {heights.map((h, i) => (
          <span
            key={i}
            className={cn("block rounded-t-full", size === "sm" ? "flex-1" : "w-[14px]", FENCE_COLORS[i % FENCE_COLORS.length])}
            style={{ height: h }}
          />
        ))}
      </span>
    </span>
  );
}

/** The word for a fit score out of 10. */
export function fitWord(score: number): string {
  if (score >= 8) return "Great fit";
  if (score >= 6) return "Good fit";
  if (score >= 4) return "Okay fit";
  return "Long shot";
}

/**
 * A rank score out of 10 as five fence boards, read like a five-star rating:
 * each board is two points, filled from the bottom (full, half or empty).
 * One color on purpose, so it reads as a meter rather than decoration.
 */
export function FitFence({ score, text, className }: { score: number; /** The number as shown, e.g. "~7.5" when a fact is unknown. */ text?: string; className?: string }) {
  const shown = text ?? score.toFixed(1);
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <span role="img" aria-label={`Fit ${shown} out of 10`} className="flex items-end gap-[3px]">
        {Array.from({ length: 5 }, (_, i) => {
          const part = Math.max(0, Math.min(1, score / 2 - i));
          const fill = part >= 0.75 ? 100 : part >= 0.25 ? 50 : 0;
          return (
            <span
              key={i}
              className="block h-[22px] w-3 rounded-t-full rounded-b-[2px] ring-[1.5px] ring-inset ring-sea-700"
              style={{ background: `linear-gradient(to top, var(--color-sea-700) ${fill}%, transparent ${fill}%)` }}
            />
          );
        })}
      </span>
      <span aria-hidden="true" className="font-display text-lg leading-none text-tar">
        {shown}
      </span>
      <span aria-hidden="true" className="text-sm font-bold text-stone-800">
        · {fitWord(score)}
      </span>
    </span>
  );
}

/** Loading a board: fence boards go up one after another (still under reduced motion). */
export function GateLoading({ label = "Opening the gate…", className }: { label?: string; className?: string }) {
  const heights = [44, 54, 38, 50, 42];
  return (
    <div role="status" className={cn("flex flex-col items-center gap-4", className)}>
      <span aria-hidden="true" className="flex h-14 items-end gap-2">
        {heights.map((h, i) => (
          <span
            key={i}
            className={cn("corral-board block w-3.5 origin-bottom rounded-t-full rounded-b-[2px]", FENCE_COLORS[i])}
            style={{ height: h, animationDelay: `${i * 0.12}s` }}
          />
        ))}
      </span>
      <span className="font-display text-lg text-tar">{label}</span>
    </div>
  );
}

/** The open gate (sign in): two posts, the gate boards swung open, the sun behind. */
export function OpenGate({ className }: { className?: string }) {
  const left = ["bg-sea-700", "bg-sunset-500", "bg-glass-500"];
  const right = ["bg-sea-300", "bg-sunset-400", "bg-sea-700"];
  const heights = [96, 104, 98];
  return (
    <span aria-hidden="true" className={cn("relative block h-[150px] w-[300px]", className)}>
      <span className="absolute bottom-0 left-1/2 h-[130px] w-[130px] -translate-x-1/2 rounded-full bg-sunset-200" />
      <span className="absolute bottom-0 left-3 h-[140px] w-5 rounded-t-full rounded-b-[3px] bg-sunset-700" />
      <span className="absolute bottom-0 right-3 h-[140px] w-5 rounded-t-full rounded-b-[3px] bg-sunset-700" />
      <span className="absolute bottom-0 left-10 flex origin-bottom-left skew-y-[-8deg] items-end gap-1.5">
        {left.map((c, i) => (
          <span key={i} className={cn("block w-3.5 rounded-t-full rounded-b-[2px]", c)} style={{ height: heights[i] }} />
        ))}
      </span>
      <span className="absolute bottom-0 right-10 flex origin-bottom-right skew-y-[8deg] items-end gap-1.5">
        {right.map((c, i) => (
          <span key={i} className={cn("block w-3.5 rounded-t-full rounded-b-[2px]", c)} style={{ height: heights[2 - i] }} />
        ))}
      </span>
    </span>
  );
}
