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
  className
}: {
  variant?: "full" | "compact" | "thin";
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
        <div
          aria-hidden="true"
          className={cn(
            "absolute -z-0 rounded-full bg-sunset-200",
            full
              ? "bottom-[-34px] right-[14%] h-[100px] w-[100px] lg:bottom-[-56px] lg:right-[300px] lg:h-[170px] lg:w-[170px]"
              : "bottom-[-40px] right-[22%] h-[78px] w-[78px] lg:right-[300px] lg:h-[110px] lg:w-[110px] lg:bottom-[-58px]"
          )}
        />
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

/** The board fence and the sea-800 footer bar. */
export function FenceFooter({ className }: { className?: string }) {
  return (
    <footer className={cn("mt-auto", className)}>
      <div aria-hidden="true" className="flex h-5 items-end gap-[6px] overflow-hidden px-6">
        {Array.from({ length: 80 }, (_, i) => (
          <span key={i} className={cn("h-5 w-[14px] shrink-0 rounded-t-full", FENCE[i % FENCE.length])} />
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 bg-sea-800 px-6 py-3.5 text-xs text-sea-100">
        <span>Not affiliated with UCSB. Demo data is fictional.</span>
        <span className="ml-auto flex gap-4">
          <a href="/privacy" className="underline-offset-4 hover:underline">Privacy</a>
          <a href="/terms" className="underline-offset-4 hover:underline">Terms</a>
        </span>
      </div>
    </footer>
  );
}

/** A two-or-three way switch in the band (desktop Map / Status). */
export function BandToggle<T extends string>({
  value,
  options,
  onChange,
  label
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div role="group" aria-label={label} className="inline-flex rounded-full border border-divider bg-shell-light p-0.5 shadow-sm">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "h-10 rounded-full px-4 text-[15px] transition",
            value === o.value ? "bg-sea-100 font-semibold text-sea-900" : "text-tar hover:bg-shell-mid"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
