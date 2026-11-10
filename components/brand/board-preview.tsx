import { streetHeadline } from "@/lib/address";
import { formatRent } from "@/lib/compare";
import { createDemoSnapshot } from "@/lib/demo-fixture";
import { formatRentShort } from "@/lib/format";
import { STATUS_LABELS, type Listing } from "@/lib/listing";
import { STATUS_STYLES, STATUS_TAG } from "@/components/board/status-style";
import { cn } from "@/lib/utils";

/**
 * A still of the demo board for the landing page: a drawn Isla Vista map with
 * rent tags, above three rows. Built from the same fixture as /demo, so it
 * never drifts from what the demo shows.
 */

// A fixed date keeps the prerendered page stable between builds.
const snapshot = createDemoSnapshot(new Date("2026-11-09T12:00:00"));
const ROWS = ["demo-sabado", "demo-dp", "demo-trigo"]
  .map((id) => snapshot.listings.find((l) => l.id === id))
  .filter((l): l is Listing => Boolean(l));

// Project IV lat/lng into the 400x180 drawing.
const W = 400;
const H = 180;
const WEST = -119.8668;
const EAST = -119.8508;
const NORTH = 34.4158;
const SOUTH = 34.4062;
const px = (lng: number) => ((lng - WEST) / (EAST - WEST)) * W;
const py = (lat: number) => ((NORTH - lat) / (NORTH - SOUTH)) * H;

const TAGS = snapshot.listings.filter(
  (l) => l.lat !== null && l.lng !== null && l.lng > WEST && l.lng < EAST && l.lat > SOUTH && l.lat < NORTH
);

export function BoardPreview({ className }: { className?: string }) {
  return (
    <figure
      className={cn("overflow-hidden rounded-[32px] bg-shell shadow-lg", className)}
      aria-label="Preview of a Corral board: a map of Isla Vista with rent tags, and places listed by street with their status and rent."
    >
      <div aria-hidden="true">
        <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="presentation">
          <rect width={W} height={H} fill="#fff9f5" />
          {[24, 52, 80, 108].map((y) => (
            <line key={`h${y}`} x1="0" x2={W} y1={y} y2={y} stroke="#f6eae3" strokeWidth="6" />
          ))}
          {[40, 95, 150, 205, 260, 315, 370].map((x) => (
            <line key={`v${x}`} x1={x} x2={x - 6} y1="0" y2="128" stroke="#f6eae3" strokeWidth="5" />
          ))}
          <path
            d={`M0 128 C 60 122, 110 134, 170 130 S 280 120, 330 128 S 385 114, ${W} 106 L ${W} ${H} L 0 ${H} Z`}
            fill="#c5e3f4"
          />
          <text x="18" y="166" fill="#1c5b82" fontSize="10" fontStyle="italic">
            Pacific Ocean
          </text>
          {TAGS.map((l) => {
            const sel = l.id === "demo-sabado";
            const label = formatRentShort(l.rentCents);
            const w = 16 + label.length * 8;
            const { bg, fg } = sel ? { bg: "#1c5b82", fg: "#fdf2ea" } : STATUS_TAG[l.status];
            return (
              <g key={l.id} transform={`translate(${px(l.lng!) - w / 2} ${py(l.lat!) - 24})`}>
                <rect width={w} height="21" rx="10.5" fill={bg} stroke="#fdf2ea" strokeWidth="2" />
                <text
                  x={w / 2}
                  y="15"
                  textAnchor="middle"
                  fontSize="12"
                  fill={fg}
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  {label}
                </text>
              </g>
            );
          })}
        </svg>

        <ul className="space-y-1 p-3">
          {ROWS.map((l, i) => (
            <li
              key={l.id}
              className={cn("flex items-center gap-3 rounded-[22px] px-3 py-2.5", i === 0 && "bg-sea-100")}
            >
              <span className="h-12 w-8 shrink-0 rounded-full bg-shell-deep" />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-display text-[15px] text-tar">
                  {streetHeadline(l.address, l.title)}
                </span>
                <span
                  className={cn(
                    "mt-1 inline-block rounded-full px-2.5 py-[2px] text-[11px] font-semibold",
                    STATUS_STYLES[l.status].chip
                  )}
                >
                  {STATUS_LABELS[l.status]}
                </span>
              </span>
              <span className={cn("shrink-0 font-display text-[15px]", l.rentCents === null ? "text-stone-700" : "text-tar")}>
                {l.rentCents === null ? "Unknown" : formatRent(l.rentCents)}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </figure>
  );
}
