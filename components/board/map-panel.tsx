"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useMemo, useRef } from "react";
import L from "leaflet";
import { MapContainer, Marker, TileLayer, Tooltip, useMap, useMapEvents } from "react-leaflet";
import { streetHeadline } from "@/lib/address";
import { isClosedStatus, type Listing } from "@/lib/listing";
import { STATUS_HEX } from "./status";

/** Isla Vista, between campus and the cliffs. */
export const IV_CENTER: [number, number] = [34.4123, -119.8605];

export type MapPanelProps = {
  listings: Listing[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  /** Called when a pin is dropped or dragged to a new spot. */
  onMovePin: (id: string, lat: number, lng: number) => void;
};

function pinIcon(listing: Listing, selected: boolean) {
  const color = STATUS_HEX[listing.status];
  const classes = ["corral-pin", selected && "is-selected", isClosedStatus(listing.status) && "is-closed"]
    .filter(Boolean)
    .join(" ");
  return L.divIcon({
    className: "corral-pin-wrap",
    html: `<span class="${classes}" style="--pin:${color}"></span>`,
    iconSize: selected ? [34, 34] : [24, 24],
    iconAnchor: selected ? [17, 34] : [12, 24]
  });
}

/**
 * Leaflet measures its container once at mount. In a flex/grid layout (and when
 * the phone List/Map toggle reveals it) the real size arrives later, so watch
 * the container, re-measure, and fit the pins only once it has a real size.
 */
function SizeAndFit({ listings }: { listings: Listing[] }) {
  const map = useMap();
  const fitted = useRef(false);
  const latest = useRef(listings);
  useEffect(() => {
    latest.current = listings;
  }, [listings]);

  useEffect(() => {
    const el = map.getContainer();
    const fit = () => {
      if (fitted.current || el.clientWidth === 0 || el.clientHeight === 0) return;
      const points = latest.current
        .filter((l) => l.lat !== null && l.lng !== null)
        .map((l) => [l.lat!, l.lng!] as [number, number]);
      fitted.current = true;
      if (points.length > 0) map.fitBounds(L.latLngBounds(points), { padding: [56, 56], maxZoom: 16 });
    };
    const ro = new ResizeObserver(() => {
      map.invalidateSize({ pan: false });
      fit();
    });
    ro.observe(el);
    map.invalidateSize({ pan: false });
    fit();
    return () => ro.disconnect();
  }, [map]);
  return null;
}

function FollowSelection({ listing }: { listing: Listing | undefined }) {
  const map = useMap();
  useEffect(() => {
    if (!listing || listing.lat === null || listing.lng === null) return;
    const target = L.latLng(listing.lat, listing.lng);
    if (!map.getBounds().pad(-0.15).contains(target)) {
      map.panTo(target, { animate: !window.matchMedia("(prefers-reduced-motion: reduce)").matches });
    }
  }, [listing, map]);
  return null;
}

function PlacePinOnClick({ listing, onMovePin }: { listing: Listing | undefined; onMovePin: MapPanelProps["onMovePin"] }) {
  const placing = listing && listing.lat === null;
  const map = useMapEvents({
    click(e) {
      if (placing) onMovePin(listing.id, round(e.latlng.lat), round(e.latlng.lng));
    }
  });
  useEffect(() => {
    map.getContainer().style.cursor = placing ? "crosshair" : "";
  }, [map, placing]);
  return null;
}

const round = (n: number) => Math.round(n * 1e6) / 1e6;

export default function MapPanel({ listings, selectedId, onSelect, onMovePin }: MapPanelProps) {
  const selected = listings.find((l) => l.id === selectedId);
  const mapped = useMemo(() => listings.filter((l) => l.lat !== null && l.lng !== null), [listings]);
  const placing = selected && selected.lat === null;

  return (
    <div className="relative h-full w-full">
      <MapContainer
        center={IV_CENTER}
        zoom={15}
        scrollWheelZoom
        className="h-full w-full"
        attributionControl
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
        />
        <SizeAndFit listings={listings} />
        <FollowSelection listing={selected} />
        <PlacePinOnClick listing={selected} onMovePin={onMovePin} />
        {mapped.map((l) => {
          const isSel = l.id === selectedId;
          return (
            <Marker
              key={`${l.id}-${isSel ? "sel" : "pin"}`}
              position={[l.lat!, l.lng!]}
              icon={pinIcon(l, isSel)}
              draggable={isSel}
              zIndexOffset={isSel ? 1000 : isClosedStatus(l.status) ? -100 : 0}
              title={streetHeadline(l.address, l.title)}
              alt={streetHeadline(l.address, l.title)}
              keyboard
              eventHandlers={{
                click: () => onSelect(l.id),
                keypress: (e) => {
                  const key = (e.originalEvent as KeyboardEvent).key;
                  if (key === "Enter" || key === " ") onSelect(l.id);
                },
                dragend: (e) => {
                  const p = (e.target as L.Marker).getLatLng();
                  onMovePin(l.id, round(p.lat), round(p.lng));
                }
              }}
            >
              <Tooltip direction="top" offset={[0, isSel ? -30 : -20]} opacity={1}>
                {streetHeadline(l.address, l.title)}
              </Tooltip>
            </Marker>
          );
        })}
      </MapContainer>

      {placing ? (
        <p className="pointer-events-none absolute inset-x-3 top-3 z-[500] rounded-md bg-ink/90 px-3 py-2 text-center text-sm font-medium text-sand shadow-lift">
          Click the map to place {streetHeadline(selected.address, selected.title)}
        </p>
      ) : selected && selected.lat !== null ? (
        <p className="pointer-events-none absolute right-3 top-3 z-[500] rounded-md bg-surface/95 px-2.5 py-1.5 text-xs text-muted shadow-soft">
          Drag the highlighted pin to fix its spot
        </p>
      ) : null}
    </div>
  );
}
