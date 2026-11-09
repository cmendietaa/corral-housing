import { streetHeadline } from "@/lib/address";
import { formatRent } from "@/lib/compare";
import { createDemoSnapshot } from "@/lib/demo-fixture";
import { formatRentShort } from "@/lib/format";
import { STATUS_LABELS, type Listing } from "@/lib/listing";
import { STATUS_HEX, STATUS_STYLES } from "@/components/board/status-style";
import { cn } from "@/lib/utils";

/**
 * A still of the demo board for the landing page: three ledger rows over a
 * drawn Isla Vista coast with rent tags. Built from the same fixture as /demo,
 * so it never drifts from what the demo shows.
 */

// A fixed date keeps the prerendered page stable between builds.
const snapshot = createDemoSnapshot(new Date("2026-11-09T12:00:00"));
const ROWS = ["demo-sabado", "demo-dp", "demo-trigo"]
  .map((id) => snapshot.listings.find((l) => l.id === id))
  .filter((l): l is Listing => Boolean(l));

// Project IV lat/lng into the 400x170 drawing.
const W = 400;
const H = 170;
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
  const members = Object.fromEntries(snapshot.board.members.map((m) => [m.id, m.name]));
  return (
    <figure
      className={cn("overflow-hidden rounded-xl border border-line bg-surface shadow-lift", className)}
      aria-label="Preview of a Corral board: places listed by street with rent and next steps, beside a map of Isla Vista with rent tags."
    >
      <div aria-hidden="true">
        <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="presentation">
          <rect width={W} height={H} fill="#f4ebdb" />
          {/* Street grid, loosely IV's blocks */}
          {[22, 48, 74, 100].map((y) => (
            <line key={`h${y}`} x1="0" x2={W} y1={y} y2={y} stroke="#fffdf9" strokeWidth="5" />
          ))}
          {[40, 95, 150, 205, 260, 315, 370].map((x) => (
            <line key={`v${x}`} x1={x} x2={x - 6} y1="0" y2="120" stroke="#fffdf9" strokeWidth="4" />
          ))}
          <line x1="0" x2={W} y1="8" y2="8" stroke="#fffdf9" strokeWidth="8" />
          {/* The coast */}
          <path
            d={`M0 118 C 60 112, 110 124, 170 120 S 280 110, 330 118 S 385 104, ${W} 96 L ${W} ${H} L 0 ${H} Z`}
            fill="#2a6a96"
          />
          <path
            d={`M0 130 C 60 124, 110 136, 170 132 S 280 122, 330 130 S 385 116, ${W} 108`}
            fill="none"
            stroke="#f7f1e8"
            strokeOpacity="0.35"
            strokeWidth="1.5"
          />
          <text x="18" y="156" fill="#f7f1e8" fontSize="10" fontStyle="italic" opacity="0.8">
            Pacific Ocean
          </text>
          {TAGS.map((l) => {
            const x = px(l.lng!);
            const y = py(l.lat!) - 4;
            const label = formatRentShort(l.rentCents);
            const w = 10 + label.length * 7;
            const sel = l.id === "demo-sabado";
            const fill = sel ? "#e8735a" : STATUS_HEX[l.status];
            return (
              <g key={l.id} transform={`translate(${x - w / 2} ${y - 22})`}>
                <rect width={w} height="17" rx="5" fill={fill} stroke="#fffdf9" strokeWidth="1.5" />
                <path d={`M${w / 2 - 5} 17 L${w / 2} 23 L${w / 2 + 5} 17 Z`} fill={fill} />
                <text
                  x={w / 2}
                  y="12.5"
                  textAnchor="middle"
                  fontSize="10.5"
                  fontWeight="800"
                  fill={sel ? "#1b2b36" : "#fff"}
                  style={{ fontFamily: "var(--font-display)", fontVariationSettings: '"CASL" 0.4' }}
                >
                  {label}
                </text>
              </g>
            );
          })}
        </svg>

        <ul className="divide-y divide-line">
          {ROWS.map((l, i) => (
            <li
              key={l.id}
              className={cn(
                "relative py-3 pl-5 pr-4",
                "before:absolute before:inset-y-2.5 before:left-2 before:w-1 before:rounded-full",
                STATUS_STYLES[l.status].edge,
                i === 0 && "bg-coral-soft/60"
              )}
            >
              <div className="flex items-baseline gap-3">
                <p className="font-display min-w-0 flex-1 truncate font-bold text-ink">
                  {streetHeadline(l.address, l.title)}
                </p>
                <p className="font-display shrink-0 font-extrabold tabular-nums text-ink">
                  {l.rentCents === null ? (
                    <span className="text-sm font-semibold text-muted">Rent unknown</span>
                  ) : (
                    <>
                      {formatRent(l.rentCents)}
                      <span className="text-[11px] font-medium text-muted">/mo</span>
                    </>
                  )}
                </p>
              </div>
              <div className="mt-1 flex min-w-0 items-center gap-2 text-xs text-muted">
                <span className={cn("shrink-0 rounded-[5px] px-1.5 py-0.5 font-semibold", STATUS_STYLES[l.status].chip)}>
                  {STATUS_LABELS[l.status]}
                </span>
                {l.nextAction ? (
                  <span className="min-w-0 truncate">
                    <span className="font-semibold text-ocean">Next</span> {l.nextAction}
                    {l.nextActionAssignee ? ` — ${members[l.nextActionAssignee]}` : ""}
                  </span>
                ) : (
                  <span className="min-w-0 truncate">{l.title}</span>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </figure>
  );
}
