import { Plus } from "lucide-react";
import type { Member } from "@/lib/listing";
import { cn } from "@/lib/utils";
import { CREW } from "@/components/board/status-style";

/**
 * The sunset-into-sea band at the top of every surface: sunset-300 sky, a
 * sunset-200 sun, the 4-color stripe, then the wave edge. Once per surface.
 *
 * `full` is the board header (title, crew). `compact` is the Status tab and
 * phone map header. `thin` is just the stripe and wave (Compare).
 */
export function Band({
  variant = "full",
  children,
  stripeRight,
  sun = true,
  className
}: {
  variant?: "full" | "compact" | "thin";
  /** False when the header places its own <BandSun /> in the gap between its content. */
  sun?: boolean;
  children?: React.ReactNode;
  /** Sits on the right of the stripe, overlapping it (crew boards and the add button). */
  stripeRight?: React.ReactNode;
  className?: string;
}) {
  if (variant === "thin") {
    return (
      <div className={cn("relative", className)} aria-hidden="true">
        <div className="corral-stripe h-6" />
        <div className="corral-wave" />
      </div>
    );
  }
  const full = variant === "full";
  return (
    <header className={cn("relative isolate overflow-hidden", className)}>
      <div className="relative overflow-hidden bg-sunset-300">
        {/* The sun, partly set behind the stripe. */}
        {sun ? <div
          aria-hidden="true"
          className={cn(
            "absolute -z-0 rounded-full bg-sunset-200",
            full
              ? "bottom-[-34px] right-[14%] h-[100px] w-[100px] lg:bottom-[-56px] lg:right-[300px] lg:h-[170px] lg:w-[170px]"
              : "bottom-[-40px] right-[22%] h-[78px] w-[78px] lg:right-[300px] lg:h-[110px] lg:w-[110px] lg:bottom-[-58px]"
          )}
        /> : null}
        <div className="relative">{children}</div>
      </div>
      <div className={cn("corral-stripe relative", full ? "h-10 lg:h-16" : "h-6 lg:h-10")}>
        {stripeRight ? (
          <div className="absolute bottom-0 right-4 flex items-end gap-1.5 lg:right-10 lg:-top-2.5 lg:bottom-auto">
            {stripeRight}
          </div>
        ) : null}
      </div>
      <div className="corral-wave" aria-hidden="true" />
    </header>
  );
}

/**
 * The sun for a header row: put it in a `relative flex-1 self-stretch` gap
 * between the row's content, so it sits centered in the open sky and never
 * behind a title or a button. It sets into the stripe below the row
 * (the row has 12px of bottom padding).
 */
export function BandSun({ size = "md", className }: { size?: "sm" | "md"; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute left-1/2 -translate-x-1/2 rounded-full bg-sunset-200",
        size === "md" ? "bottom-[-78px] h-[120px] w-[120px]" : "bottom-[-50px] h-[68px] w-[68px]",
        className
      )}
    />
  );
}

/** Roommates as vertical boards with their initial at the top. */
export function CrewBoards({ members, size = "md" }: { members: Member[]; size?: "sm" | "md" }) {
  return (
    <ul className="flex items-end gap-1.5" aria-label={`Roommates: ${members.map((m) => m.name).join(", ")}`}>
      {members.map((m, i) => (
        <li key={m.id} title={m.name}>
          <CrewPill name={m.name} index={i} size={size} />
        </li>
      ))}
    </ul>
  );
}

export function CrewPill({ name, index, size = "md" }: { name: string; index: number; size?: "xs" | "sm" | "md" }) {
  const c = CREW[index % CREW.length];
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex justify-center rounded-full font-display shadow-sm",
        c.bg,
        c.fg,
        size === "md" && "h-[58px] w-[30px] pt-2 text-sm",
        size === "sm" && "h-[44px] w-[24px] pt-1.5 text-xs",
        size === "xs" && "h-[34px] w-[18px] pt-1 text-[10px]"
      )}
    >
      {name[0]}
    </span>
  );
}

/** The Tar "+" board that adds a place. */
export function AddBoardButton({
  onClick,
  className,
  size = "md"
}: {
  onClick: () => void;
  className?: string;
  size?: "md" | "sm";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Add a place"
      title="Add a place"
      className={cn(
        "flex shrink-0 justify-center rounded-full bg-tar text-sunset-300 shadow-md transition hover:-translate-y-0.5",
        size === "md" ? "h-[76px] w-11 pt-5" : "h-16 w-11 items-center"
      )}
    >
      <Plus className="h-5 w-5" strokeWidth={2.75} aria-hidden="true" />
    </button>
  );
}

const FENCE = ["bg-sea-700", "bg-sunset-500", "bg-glass-500", "bg-sea-300", "bg-sunset-300"];

/** Said once, on the public pages (landing, sign-in, privacy, terms); boards don't repeat it. */
export const NOT_AFFILIATED = "Not affiliated with UCSB.";

/** The board fence and the sea-800 footer bar. `note` is the line on the left, if any. */
export function FenceFooter({ className, note = NOT_AFFILIATED }: { className?: string; note?: string | null }) {
  return (
    <footer className={cn("mt-auto", className)}>
      <div aria-hidden="true" className="flex h-5 items-end gap-[6px] overflow-hidden px-6">
        {Array.from({ length: 80 }, (_, i) => (
          <span key={i} className={cn("h-5 w-[14px] shrink-0 rounded-t-full", FENCE[i % FENCE.length])} />
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 bg-sea-800 px-6 py-3.5 text-xs text-sea-100">
        {note ? <span>{note}</span> : null}
        <span className="ml-auto flex gap-4">
          <a href="/privacy" className="underline-offset-4 hover:underline">Privacy</a>
          <a href="/terms" className="underline-offset-4 hover:underline">Terms</a>
        </span>
      </div>
    </footer>
  );
}

/** The footer's fine print, for panes that scroll on their own (desktop Map and Rank). */
export function FinePrint({ className, note }: { className?: string; note?: string | null }) {
  return (
    <p className={cn("flex flex-wrap items-center gap-x-4 gap-y-1 px-2 text-xs text-stone-700", className)}>
      {note ? <span>{note}</span> : null}
      <a href="/privacy" className="underline-offset-4 hover:underline">Privacy</a>
      <a href="/terms" className="underline-offset-4 hover:underline">Terms</a>
    </p>
  );
}

export { BandToggle } from "./band-toggle";
