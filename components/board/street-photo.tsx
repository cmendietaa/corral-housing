"use client";

import { useEffect, useState } from "react";
import { formatPhotoDate, streetViewSrc, type PhotoSize } from "@/lib/streetview";
import { cn } from "@/lib/utils";

/**
 * A Street View frame. The frame's size and shape come from `className`, and
 * never change: when there's no photo (no pin, no key, no imagery nearby, or a
 * load error) it shows the fence fallback, three dashed boards, instead.
 */
export function StreetPhoto({
  lat,
  lng,
  label,
  size,
  enabled,
  attribution = "short",
  hint = false,
  className,
  children
}: {
  lat: number | null;
  lng: number | null;
  /** Place name for the alt text, e.g. "Sabado Tarde, 6512". */
  label: string;
  size: PhotoSize;
  /** Whether Street View is configured on this deployment. Without it, no request is made. */
  enabled: boolean;
  /** The required Google credit, shown whenever a photo is. */
  attribution?: "short" | "long" | "tiny";
  /** Large frames explain why there's no photo. */
  hint?: boolean;
  className?: string;
  /** Overlays (back button, star) drawn on top of the frame. */
  children?: React.ReactNode;
}) {
  const src = enabled ? streetViewSrc(lat, lng, size) : null;
  const [state, setState] = useState<"loading" | "loaded" | "failed">("loading");
  // A new pin means a new photo.
  const [lastSrc, setLastSrc] = useState(src);
  if (src !== lastSrc) {
    setLastSrc(src);
    setState("loading");
  }

  // Large frames say when the photo was taken, so old imagery reads as old.
  const [taken, setTaken] = useState<{ src: string; date: string | null } | null>(null);
  useEffect(() => {
    if (attribution !== "long" || state !== "loaded" || !src || lat === null || lng === null || taken?.src === src) return;
    let cancelled = false;
    fetch(`/api/streetview/date?lat=${lat}&lng=${lng}`)
      .then((r) => r.json() as Promise<{ date: string | null }>)
      .then((d) => !cancelled && setTaken({ src, date: d.date }))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [attribution, state, src, lat, lng, taken?.src]);
  const takenLabel = taken?.src === src ? formatPhotoDate(taken.date) : null;

  const showPhoto = src !== null && state !== "failed";
  const noPin = lat === null || lng === null;

  return (
    <div className={cn("relative shrink-0 overflow-hidden bg-shell-deep", className)}>
      {showPhoto ? (
        <>
          {/* A plain img: the photo comes from our own proxy and must not be re-cached by an optimizer. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={`Street View near ${label}`}
            loading="lazy"
            decoding="async"
            onLoad={() => setState("loaded")}
            onError={() => setState("failed")}
            className={cn(
              "washed h-full w-full object-cover transition-opacity duration-300",
              state === "loaded" ? "opacity-100" : "opacity-0"
            )}
          />
          {state === "loaded" ? <Credit kind={attribution} taken={takenLabel} /> : null}
        </>
      ) : (
        <FenceFallback text={hint ? (noPin ? "Drop a pin to see the street" : "No street photo here") : undefined} />
      )}
      {children}
    </div>
  );
}

function Credit({ kind, taken }: { kind: "short" | "long" | "tiny"; taken?: string | null }) {
  return (
    <span
      className={cn(
        "pointer-events-none absolute rounded-full bg-shell font-semibold text-tar",
        kind === "tiny" ? "bottom-1 right-1 px-1 text-[7px] leading-3" : "bottom-2.5 right-2.5 px-2 py-0.5 text-[10px]"
      )}
    >
      {kind === "long" ? `Street View${taken ? ` · ${taken}` : ""} · © Google` : "© Google"}
    </span>
  );
}

/** Three dashed outline boards: "nothing here yet" in Corral's vocabulary. */
export function FenceFallback({ text, className }: { text?: string; className?: string }) {
  return (
    <div className={cn("flex h-full w-full items-center justify-center gap-2.5 p-2", className)}>
      <svg viewBox="0 0 48 48" aria-hidden="true" className="h-8 w-8 max-h-[60%] max-w-[60%] shrink-0">
        {[
          { x: 7, y: 11, h: 29 },
          { x: 19.5, y: 6, h: 34 },
          { x: 32, y: 14, h: 26 }
        ].map((b) => (
          <rect
            key={b.x}
            x={b.x}
            y={b.y}
            width="9"
            height={b.h}
            rx="4.5"
            fill="none"
            stroke="#a19786"
            strokeWidth="1.5"
            strokeDasharray="3 2.5"
          />
        ))}
      </svg>
      {text ? <span className="text-xs text-stone-700">{text}</span> : null}
    </div>
  );
}
