/**
 * Pure path builders. These produce the on-disk layout for canvases and tiles
 * without touching the filesystem.
 */

import { basename, extname, join } from "node:path";
import type { TileFormat } from "./types.ts";

/** File extension for a tile format (`jpeg` → `jpg`). */
export function tileExtension(format: TileFormat): string {
  return format === "jpeg" ? "jpg" : format;
}

/** Intermediate canvas image for one zoom level (always lossless PNG). */
export function canvasFilePath(targetPath: string, zoom: number): string {
  return join(targetPath, `canvas_${zoom}.png`);
}

/** Directory holding all tiles for one column at one zoom level. */
export function tileDirectory(targetPath: string, zoom: number, x: number): string {
  return join(targetPath, String(zoom), String(x));
}

/** Path of a single tile within its column directory (`y` must be final). */
export function tileFilePath(directory: string, y: number, format: TileFormat, retina: boolean): string {
  const suffix = retina ? "@2x" : "";
  return join(directory, `${y}${suffix}.${tileExtension(format)}`);
}

/** Directory name used for a source when running a batch (basename w/o ext). */
export function outputDirName(sourcePath: string): string {
  const base = basename(sourcePath);
  const ext = extname(base);
  return ext ? base.slice(0, -ext.length) : base;
}
