/**
 * Pure generators for the optional output files: a Leaflet `index.html` preview
 * and a `tiles.json` metadata file. Both are plain string/object builders.
 */

import { tileExtension } from "./paths.ts";
import type { CutOptions, CutResult } from "./types.ts";

/** Build the metadata object written to `tiles.json`. */
export function buildMetadata(result: CutResult, options: CutOptions): Record<string, unknown> {
  return {
    tileSize: options.tileSize,
    format: options.format,
    minZoom: result.minZoom,
    maxZoom: result.maxZoom,
    tms: options.tms,
    retina: options.retina,
    fit: options.fit,
    source: { width: result.source.width, height: result.source.height },
    totalTiles: result.totalTiles,
    levels: result.levels,
  };
}

/** Build a self-contained Leaflet viewer (`index.html`) for the tiles. */
export function buildPreviewHtml(result: CutResult, options: CutOptions): string {
  const ext = tileExtension(options.format);
  const tmsOption = options.tms ? "      tms: true,\n" : "";

  return [
    "<!DOCTYPE html>",
    "<html>",
    "<head>",
    '  <meta charset="utf-8">',
    "  <title>pmaptilescutter preview</title>",
    '  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">',
    "  <style>html,body,#map{height:100%;margin:0}</style>",
    "</head>",
    "<body>",
    '  <div id="map"></div>',
    '  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>',
    "  <script>",
    `    const minZoom = ${result.minZoom};`,
    `    const maxZoom = ${result.maxZoom};`,
    `    const tileSize = ${options.tileSize};`,
    "    const map = L.map('map', {",
    "      crs: L.CRS.Simple,",
    "      minZoom: minZoom,",
    "      maxZoom: maxZoom,",
    "      maxBounds: [[0, 0], [tileSize, tileSize]],",
    "      maxBoundsViscosity: 1.0,",
    "    });",
    `    L.tileLayer('{z}/{x}/{y}.${ext}', {`,
    "      tileSize: tileSize,",
    "      noWrap: true,",
    "      bounds: [[0, 0], [tileSize, tileSize]],",
    tmsOption,
    "    }).addTo(map);",
    "    map.fitBounds([[0, 0], [tileSize, tileSize]]);",
    "  </script>",
    "</body>",
    "</html>",
    "",
  ].join("\n");
}
