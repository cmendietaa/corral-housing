"use client";

import { useState } from "react";
import { MapPin } from "lucide-react";
import { streetViewSrc } from "@/lib/streetview";
import { cn } from "@/lib/utils";

/**
 * A Street View photo of the place, from our /api/streetview proxy. Falls back
 * to a quiet sand tile when the place has no pin, there's no imagery nearby,
 * or Street View isn't configured.
 */
export function StreetPhoto({
  lat,
  lng,
  label,
  className
}: {
  lat: number | null;
  lng: number | null;
  /** Place name for the alt text, e.g. "Sabado Tarde, 6512". */
  label: string;
  className?: string;
}) {
  const src = streetViewSrc(lat, lng);
  const [state, setState] = useState<"loading" | "loaded" | "failed">("loading");
  // Reset when the place moves (a new pin means a new photo).
  const [lastSrc, setLastSrc] = useState(src);
  if (src !== lastSrc) {
    setLastSrc(src);
    setState("loading");
  }

  const box = cn("relative shrink-0 overflow-hidden rounded-md bg-sand-deep", className);

  if (!src || state === "failed") {
    return (
      <div className={cn(box, "flex flex-col items-center justify-center gap-0.5 text-muted/70")}>
        <MapPin className="h-4 w-4" aria-hidden="true" />
        <span className="px-1 text-center text-[10px] font-medium leading-tight">
          {src ? "No street photo" : "No pin yet"}
        </span>
      </div>
    );
  }

  return (
    <div className={cn(box, state === "loading" && "animate-pulse")}>
      {/* A plain img: the photo comes from our own proxy and must not be re-cached by an optimizer. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={`Street View near ${label}`}
        loading="lazy"
        decoding="async"
        onLoad={() => setState("loaded")}
        onError={() => setState("failed")}
        className={cn("h-full w-full object-cover transition-opacity", state === "loaded" ? "opacity-100" : "opacity-0")}
      />
    </div>
  );
}
