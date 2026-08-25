/**
 * Pure input validation.
 */

import type { FitMode, TileFormat } from "./types.ts";

/** Parse a CLI-provided tile size into a positive integer, or throw. */
export function parseTileSize(value: string): number {
  if (!/^\d+$/.test(value)) {
    throw new Error(`Invalid tile size "${value}". Expected a positive integer.`);
  }
  const parsed = Number(value);
  if (parsed <= 0) {
    throw new Error(`Invalid tile size "${value}". Expected a positive integer.`);
  }
  return parsed;
}

/** Parse a tile format (`png`, `jpeg`, `webp`). */
export function parseFormat(value: string): TileFormat {
  if (value === "png" || value === "jpeg" || value === "webp") {
    return value;
  }
  throw new Error(`Invalid format "${value}". Expected png, jpeg or webp.`);
}

/** Parse a fit mode (`contain`, `cover`, `fill`). */
export function parseFit(value: string): FitMode {
  if (value === "contain" || value === "cover" || value === "fill") {
    return value;
  }
  throw new Error(`Invalid fit "${value}". Expected contain, cover or fill.`);
}

/** Parse a non-negative integer zoom level. */
export function parseZoom(value: string): number {
  if (!/^\d+$/.test(value)) {
    throw new Error(`Invalid zoom "${value}". Expected a non-negative integer.`);
  }
  return Number(value);
}

/** Parse a positive integer concurrency value. */
export function parseConcurrency(value: string): number {
  if (!/^\d+$/.test(value)) {
    throw new Error(`Invalid concurrency "${value}". Expected a positive integer.`);
  }
  const parsed = Number(value);
  if (parsed <= 0) {
    throw new Error(`Invalid concurrency "${value}". Expected a positive integer.`);
  }
  return parsed;
}

/** Parse an integer quality value in the 0..100 range. */
export function parseQuality(value: string): number {
  if (!/^\d+$/.test(value)) {
    throw new Error(`Invalid quality "${value}". Expected an integer between 0 and 100.`);
  }
  const parsed = Number(value);
  if (parsed < 0 || parsed > 100) {
    throw new Error(`Invalid quality "${value}". Expected an integer between 0 and 100.`);
  }
  return parsed;
}
