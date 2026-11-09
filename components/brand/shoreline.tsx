import { useId } from "react";
import { cn } from "@/lib/utils";

/** Corral's signature rule: a gentle swell in ocean blue, drawn to any width. */
export function Shoreline({ className }: { className?: string }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg aria-hidden="true" className={cn("block h-3 w-full", className)} preserveAspectRatio="none" viewBox="0 0 400 12">
      <defs>
        <pattern id={`swell-${id}`} width="40" height="12" patternUnits="userSpaceOnUse">
          <path d="M0 6 Q10 0 20 6 T40 6" fill="none" stroke="var(--color-ocean)" strokeWidth="2" strokeLinecap="round" />
        </pattern>
      </defs>
      <rect width="400" height="12" fill={`url(#swell-${id})`} />
    </svg>
  );
}
