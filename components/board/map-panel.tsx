"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef, useState } from "react";
import { AttributionControl, LngLatBounds, Map as MapLibreMap, Marker, NavigationControl } from "maplibre-gl";
import { streetHeadline } from "@/lib/address";
import { formatRentShort } from "@/lib/format";
import { isClosedStatus, type Listing } from "@/lib/listing";
import { mainCluster } from "@/lib/map-view";
import { applyCoastalStyle, BASE_STYLE_URL } from "./map-style";
import { STATUS_TAG } from "./status-style";

/** Isla Vista, between campus and the cliffs. */
const IV_CENTER: [number, number] = [-119.8605, 34.4123];

export type MapPanelProps = {
  listings: Listing[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  /** Called when a pin is dropped or dragged to a new spot. */
  onMovePin: (id: string, lat: number, lng: number) => void;
};

const round = (n: number) => Math.round(n * 1e6) / 1e6;
const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

type Mapped = Listing & { lat: number; lng: number };
const isMapped = (l: Listing): l is Mapped => l.lat !== null && l.lng !== null;

/**
 * The part of the map that overlays don't cover: on desktop the place card
 * (bottom-left, 330px) and the 200px top-left curve; on phones the mini card
 * and the List / Map switch at the bottom.
 */
function overlayPadding(el: HTMLElement) {
  const wide = window.matchMedia("(min-width: 1024px)").matches;
  return wide
    ? { top: 110, bottom: 90, left: Math.min(390, el.clientWidth * 0.5), right: 80 }
    : { top: 70, bottom: 230, left: 40, right: 40 };
}

function boundsOf(points: { lat: number; lng: number }[]) {
  const b = new LngLatBounds();
  for (const p of points) b.extend([p.lng, p.lat]);
  return b;
}

export default function MapPanel({ listings, selectedId, onSelect, onMovePin }: MapPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markers = useRef(new Map<string, Marker>());
  const fitted = useRef(false);
  // Once someone pans or zooms, stop re-fitting the view on layout changes.
  const userMoved = useRef(false);
  const [ready, setReady] = useState(false);
  const [hasOutside, setHasOutside] = useState(false);

  // Latest props for map event handlers created once.
  const latest = useRef({ listings, selectedId, onSelect, onMovePin });
  useEffect(() => {
    latest.current = { listings, selectedId, onSelect, onMovePin };
  });

  function fitToCluster(all: boolean) {
    const map = mapRef.current;
    const el = containerRef.current;
    if (!map || !el || el.clientWidth === 0 || el.clientHeight === 0) return;
    const points = latest.current.listings.filter(isMapped);
    fitted.current = true;
    const { cluster, outside } = mainCluster(points);
    setHasOutside(outside.length > 0);
    const target = all ? points : cluster;
    if (target.length === 0) return;
    map.fitBounds(boundsOf(target), {
      padding: overlayPadding(el),
      maxZoom: 16.5,
      animate: all && !reducedMotion()
    });
  }

  // Create the map once.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const map = new MapLibreMap({
      container: el,
      style: BASE_STYLE_URL,
      center: IV_CENTER,
      zoom: 15,
      attributionControl: false,
      dragRotate: false,
      pitchWithRotate: false,
      touchPitch: false
    });
    map.touchZoomRotate.disableRotation();
    // The OpenStreetMap credit must stay visible: bottom-right on desktop (beside the
    // tray), top-left on phones (the bottom belongs to the place card and the switch).
    const wide = window.matchMedia("(min-width: 1024px)").matches;
    map.addControl(new AttributionControl({ compact: false }), wide ? "bottom-right" : "top-left");
    // Top-right, because the panel has a big 200px curve at its top-left corner.
    map.addControl(new NavigationControl({ showCompass: false }), "top-right");
    map.on("style.load", () => applyCoastalStyle(map));
    map.on("load", () => setReady(true));
    map.on("movestart", (e) => {
      if ((e as { originalEvent?: unknown }).originalEvent) userMoved.current = true;
    });
    map.on("click", (e) => {
      const { listings: ls, selectedId: sel, onMovePin: move } = latest.current;
      const placing = ls.find((l) => l.id === sel && l.lat === null);
      if (placing) move(placing.id, round(e.lngLat.lat), round(e.lngLat.lng));
    });
    mapRef.current = map;

    // The container's real size arrives after layout (and after the phone
    // List/Map switch reveals it). Re-measure, and fit once it's real.
    const ro = new ResizeObserver(() => {
      map.resize();
      if (!fitted.current || !userMoved.current) fitToCluster(false);
    });
    ro.observe(el);

    const currentMarkers = markers.current;
    return () => {
      ro.disconnect();
      currentMarkers.forEach((m) => m.remove());
      currentMarkers.clear();
      map.remove();
      mapRef.current = null;
    };
    // Created once; handlers read the latest props through refs.
  }, []);

  // Keep markers in sync with listings and selection.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const seen = new Set<string>();
    for (const l of listings.filter(isMapped)) {
      seen.add(l.id);
      const selected = l.id === selectedId;
      const label = streetHeadline(l.address, l.title);
      let marker = markers.current.get(l.id);
      if (!marker) {
        const el = document.createElement("button");
        el.type = "button";
        el.className = "corral-tag";
        el.innerHTML = '<span class="corral-tag-label"></span>';
        el.addEventListener("click", (e) => {
          e.stopPropagation();
          latest.current.onSelect(l.id);
        });
        const created = new Marker({ element: el, anchor: "bottom" }).setLngLat([l.lng, l.lat]).addTo(map);
        created.on("dragend", () => {
          const p = created.getLngLat();
          latest.current.onMovePin(l.id, round(p.lat), round(p.lng));
        });
        markers.current.set(l.id, created);
        marker = created;
      } else {
        marker.setLngLat([l.lng, l.lat]);
      }
      const el = marker.getElement();
      const rent = formatRentShort(l.rentCents);
      const rentWords = l.rentCents === null ? "rent unknown" : rent;
      el.querySelector(".corral-tag-label")!.textContent = rent;
      el.setAttribute(
        "aria-label",
        selected ? `${label}, ${rentWords}, selected. Drag to move the pin.` : `${label}, ${rentWords}`
      );
      el.title = label;
      el.style.setProperty("--pin-bg", STATUS_TAG[l.status].bg);
      el.style.setProperty("--pin-fg", STATUS_TAG[l.status].fg);
      el.style.zIndex = selected ? "3" : isClosedStatus(l.status) ? "1" : "2";
      el.classList.toggle("is-selected", selected);
      el.classList.toggle("is-closed", isClosedStatus(l.status));
      marker.setDraggable(selected);
    }
    for (const [id, marker] of markers.current) {
      if (!seen.has(id)) {
        marker.remove();
        markers.current.delete(id);
      }
    }
    if (!fitted.current) fitToCluster(false);
    else setHasOutside(mainCluster(listings.filter(isMapped)).outside.length > 0);
  }, [listings, selectedId, ready]);

  // Bring the selected pin into view, and show a crosshair while placing one.
  const selected = listings.find((l) => l.id === selectedId);
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.getCanvas().style.cursor = selected && selected.lat === null ? "crosshair" : "";
    if (!selected || !isMapped(selected)) return;
    // Only move when the pin is outside the uncovered part of the map, and then
    // center it in that part rather than behind the place card.
    const el = map.getContainer();
    const pad = overlayPadding(el);
    const pt = map.project([selected.lng, selected.lat]);
    const inside =
      pt.x > pad.left && pt.x < el.clientWidth - pad.right && pt.y > pad.top && pt.y < el.clientHeight - pad.bottom;
    if (!inside) {
      const center: [number, number] = [selected.lng, selected.lat];
      if (reducedMotion()) map.jumpTo({ center, padding: pad });
      else map.easeTo({ center, padding: pad, duration: 500 });
    }
  }, [selected, ready]);

  const placing = selected && selected.lat === null;

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="h-full w-full" />

      {placing ? (
        <p className="pointer-events-none absolute left-1/2 top-4 z-10 w-max max-w-[calc(100%-7rem)] -translate-x-1/2 rounded-full bg-sea-800 px-4 py-2 text-center text-sm font-semibold text-sea-100 shadow-lg">
          Click the map to drop a pin for {streetHeadline(selected.address, selected.title)}
        </p>
      ) : null}

      {hasOutside ? (
        <button
          type="button"
          onClick={() => fitToCluster(true)}
          className="absolute right-2.5 top-[5.75rem] z-10 h-9 rounded-full border border-divider bg-shell-light px-4 font-display text-[13px] text-tar shadow-md transition hover:bg-shell-mid lg:right-14 lg:top-2.5"
        >
          Show all places
        </button>
      ) : null}
    </div>
  );
}
