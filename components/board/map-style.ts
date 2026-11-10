import type { Map as MapLibreMap } from "maplibre-gl";

/**
 * OpenFreeMap's Positron vector style (no API key), recolored to the Corral v2
 * palette: Shell land, pale sea-200 water, white roads, stone labels, and no
 * POI or transit clutter.
 */
export const BASE_STYLE_URL = "https://tiles.openfreemap.org/styles/positron";

// v2 palette: Shell land, Del Playa sea-200 water, white roads, stone-700 labels, no POIs.
const P = {
  land: "#fff9f5",
  water: "#c5e3f4",
  green: "#eef0e0",
  building: "#f6eae3",
  casing: "#efe2d8",
  road: "#ffffff",
  label: "#645c50",
  waterLabel: "#1c5b82"
};

export function applyCoastalStyle(map: MapLibreMap) {
  const layers = map.getStyle()?.layers ?? [];
  for (const layer of layers) {
    const { id, type } = layer;
    try {
      if (type === "background") {
        map.setPaintProperty(id, "background-color", P.land);
      } else if (type === "fill" && /water/.test(id)) {
        map.setPaintProperty(id, "fill-color", P.water);
      } else if (type === "line" && /waterway/.test(id)) {
        map.setPaintProperty(id, "line-color", P.water);
      } else if (type === "fill" && /park|wood|grass|landcover|landuse/.test(id)) {
        map.setPaintProperty(id, "fill-color", P.green);
      } else if (type === "fill" && /building/.test(id)) {
        map.setPaintProperty(id, "fill-color", P.building);
      } else if (type === "line" && /casing/.test(id)) {
        map.setPaintProperty(id, "line-color", P.casing);
      } else if (type === "line" && /highway|road|street|bridge|tunnel/.test(id)) {
        map.setPaintProperty(id, "line-color", P.road);
        map.setPaintProperty(id, "line-width", [
          "interpolate", ["exponential", 1.5], ["zoom"], 12, 1, 16, 7, 18, 18
        ]);
      } else if (type === "symbol" && /poi|airport|aeroway|transit|rail|housenumber/.test(id)) {
        map.setLayoutProperty(id, "visibility", "none");
      } else if (type === "symbol" && /water/.test(id)) {
        map.setPaintProperty(id, "text-color", P.waterLabel);
        map.setPaintProperty(id, "text-halo-color", P.land);
      } else if (type === "symbol") {
        map.setPaintProperty(id, "text-color", P.label);
        map.setPaintProperty(id, "text-halo-color", P.land);
        if (/road|street|highway|transportation_name/.test(id)) map.setLayoutProperty(id, "text-size", 13);
      }
    } catch {
      // A layer without that property: leave it as the base style draws it.
    }
  }
}
