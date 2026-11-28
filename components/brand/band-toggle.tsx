"use client";

import { useId } from "react";
import { motion } from "motion/react";
import { MOVE } from "@/lib/motion";
import { cn } from "@/lib/utils";

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
  const id = useId();
  return (
    <div role="group" aria-label={label} className="inline-flex rounded-full border border-divider bg-shell-light p-0.5 shadow-sm">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "relative h-10 rounded-full px-4 text-[15px] transition-colors",
            value === o.value ? "font-semibold text-sea-900" : "text-tar hover:bg-shell-mid"
          )}
        >
          {/* The highlight slides from the old choice to the new one. */}
          {value === o.value ? <motion.span layoutId={`toggle-${id}`} transition={MOVE} aria-hidden="true" className="absolute inset-0 rounded-full bg-sea-100" /> : null}
          <span className="relative">{o.label}</span>
        </button>
      ))}
    </div>
  );
}
