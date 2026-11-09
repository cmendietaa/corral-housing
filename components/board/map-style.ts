import type { Map as MapLibreMap } from "maplibre-gl";

/**
 * "Coastal IV, bold": OpenFreeMap's Positron vector style (no API key),
 * recolored to the board palette. Deep ocean-blue sea, sand land, wide white
 * streets, ocean-blue street names, and no POI/transit clutter.
 */
export const BASE_STYLE_URL = "https://tiles.openfreemap.org/styles/positron";

const P = {
  land: "#f4ebdb",
  water: "#2a6a96",
  green: "#e2e2c4",
  building: "#ece1ce",
  casing: "#e0d3bb",
  road: "#fffdf9",
  label: "#1f5f8b",
  waterLabel: "#f7f1e8"
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
          "interpolate", ["exponential", 1.5], ["zoom"], 12, 1, 16, 8.5, 18, 22
        ]);
      } else if (type === "symbol" && /poi|airport|aeroway|transit|rail|housenumber/.test(id)) {
        map.setLayoutProperty(id, "visibility", "none");
      } else if (type === "symbol" && /water/.test(id)) {
        map.setPaintProperty(id, "text-color", P.waterLabel);
        map.setPaintProperty(id, "text-halo-color", P.water);
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
