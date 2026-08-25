/**
 * Pure geometry functions. No I/O, no side effects — every function maps input
 * data to output data, which makes the whole module trivially unit-testable.
 */

import type {
  FitMode,
  ImageDimensions,
  Offset,
  ResizeSpec,
  TileCoordinate,
  TileGrid,
  ZoomLevelPlan,
  ZoomPlan,
} from "./types.ts";

/** Halve `dimension` `scale` times, rounding up (never drops a pixel). */
export function scaleDimension(dimension: number, scale: number): number {
  return Math.ceil(dimension / 2 ** scale);
}

/** A zoom level's canvas is a square of `tileSize * 2^zoom` pixels. */
export function canvasDimensions(zoom: number, tileSize: number): ImageDimensions {
  const side = tileSize * 2 ** zoom;
  return { width: side, height: side };
}

/** Scale both dimensions of an image by the same `scale` factor. */
export function scaledImageDimensions(dimensions: ImageDimensions, scale: number): ImageDimensions {
  return {
    width: scaleDimension(dimensions.width, scale),
    height: scaleDimension(dimensions.height, scale),
  };
}

/** Center the image on the canvas; leftover space becomes the aspect-ratio bars. */
export function centeredOffset(canvas: ImageDimensions, image: ImageDimensions): Offset {
  return {
    left: Math.floor((canvas.width - image.width) / 2),
    top: Math.floor((canvas.height - image.height) / 2),
  };
}

/**
 * Highest zoom level so that the largest image side still fits on the canvas.
 * Always at least 1 so a tile-sized image still gets zoom levels 0 and 1.
 */
export function maxZoomLevel(dimensions: ImageDimensions, tileSize: number): number {
  const maxTileDimension = Math.ceil(Math.max(dimensions.width, dimensions.height) / tileSize);
  let zoom = 1;
  while (2 ** zoom < maxTileDimension) {
    zoom += 1;
  }
  return zoom;
}

/** Resize spec for "contain": scale to fit the canvas, centered with bars. */
function containResize(source: ImageDimensions, canvas: ImageDimensions, scale: number): ResizeSpec {
  const image = scaledImageDimensions(source, scale);
  return {
    width: image.width,
    height: image.height,
    fit: "fill",
    offset: centeredOffset(canvas, image),
  };
}

/** Resize spec for "cover": scale to cover the canvas (sharp crops to center). */
function coverResize(canvas: ImageDimensions): ResizeSpec {
  return { width: canvas.width, height: canvas.height, fit: "cover", offset: { left: 0, top: 0 } };
}

/** Resize spec for "fill": stretch to exactly the canvas size. */
function fillResize(canvas: ImageDimensions): ResizeSpec {
  return { width: canvas.width, height: canvas.height, fit: "fill", offset: { left: 0, top: 0 } };
}

/** Compute the resize spec for one level according to the fit mode. */
export function resizeForLevel(
  fit: FitMode,
  source: ImageDimensions,
  canvas: ImageDimensions,
  scale: number,
): ResizeSpec {
  switch (fit) {
    case "contain":
      return containResize(source, canvas, scale);
    case "cover":
      return coverResize(canvas);
    case "fill":
      return fillResize(canvas);
  }
}

/**
 * Build the zoom plan for a source image over the inclusive zoom range.
 * `maxZoom` is explicit here; the caller decides auto vs. user override.
 */
export function buildZoomPlan(
  dimensions: ImageDimensions,
  tileSize: number,
  options: { minZoom: number; maxZoom: number; fit: FitMode },
): ZoomPlan {
  const computedMaxZoom = maxZoomLevel(dimensions, tileSize);
  const { minZoom, maxZoom, fit } = options;

  if (!Number.isInteger(minZoom) || minZoom < 0) {
    throw new Error(`Invalid minZoom ${minZoom}. Expected a non-negative integer.`);
  }
  if (!Number.isInteger(maxZoom) || maxZoom < minZoom) {
    throw new Error(`Invalid maxZoom ${maxZoom}. Expected an integer >= minZoom.`);
  }

  const levels: ZoomLevelPlan[] = [];
  for (let zoom = minZoom; zoom <= maxZoom; zoom += 1) {
    const canvas = canvasDimensions(zoom, tileSize);
    const scale = computedMaxZoom - zoom;
    levels.push({ zoom, canvas, resize: resizeForLevel(fit, dimensions, canvas, scale) });
  }

  return { levels, minZoom, maxZoom, computedMaxZoom };
}

/** Divide a canvas into a grid of equal-sized tiles. */
export function tileGrid(canvas: ImageDimensions, tileSize: number): TileGrid {
  const columns = canvas.width / tileSize;
  const rows = canvas.height / tileSize;
  return { columns, rows, total: columns * rows };
}

/** Enumerate every tile in a grid, row-major order. */
export function tileCoordinates(grid: TileGrid): TileCoordinate[] {
  const coordinates: TileCoordinate[] = [];
  for (let y = 0; y < grid.rows; y += 1) {
    for (let x = 0; x < grid.columns; x += 1) {
      coordinates.push({ x, y });
    }
  }
  return coordinates;
}

/** Convert a top-left-origin Y coordinate to TMS (bottom-left-origin). */
export function tmsY(y: number, zoom: number): number {
  return 2 ** zoom - 1 - y;
}
