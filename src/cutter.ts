/**
 * Orchestration layer: turns options into a zoom plan and drives the `ImageIO`
 * effects. Contains no direct I/O itself — it only coordinates.
 */

import { join } from "node:path";

import { parseHexColor } from "./color.ts";
import { buildMetadata, buildPreviewHtml } from "./export.ts";
import {
  buildZoomPlan,
  canvasDimensions,
  maxZoomLevel,
  resizeForLevel,
  tileCoordinates,
  tileGrid,
} from "./geometry.ts";
import { canvasFilePath } from "./paths.ts";
import type {
  CutOptions,
  CutResult,
  ImageDimensions,
  ImageIO,
  LevelSummary,
  ResizeSpec,
  TileRenderOptions,
} from "./types.ts";

/** A single canvas image to render (its zoom, size and source resize). */
interface CanvasPlan {
  zoom: number;
  canvas: ImageDimensions;
  resize: ResizeSpec;
}

/** Cut a source image into map tiles using the provided I/O backend. */
export async function cutTiles(options: CutOptions, io: ImageIO): Promise<CutResult> {
  io.ensureDirectory(options.targetPath);

  const dimensions = await io.readDimensions(options.sourcePath);
  const computedMaxZoom = maxZoomLevel(dimensions, options.tileSize);
  const maxZoom = options.maxZoom ?? computedMaxZoom;
  const plan = buildZoomPlan(dimensions, options.tileSize, {
    minZoom: options.minZoom,
    maxZoom,
    fit: options.fit,
  });
  const color = parseHexColor(options.aspectRatioBarsColor);

  // Summary is pure and drives both the result and the dry-run path.
  const levels: LevelSummary[] = [];
  let totalTiles = 0;
  for (const level of plan.levels) {
    const grid = tileGrid(level.canvas, options.tileSize);
    levels.push({ zoom: level.zoom, columns: grid.columns, rows: grid.rows, tileCount: grid.total });
    totalTiles += grid.total * (options.retina ? 2 : 1);
  }

  const result: CutResult = {
    source: dimensions,
    zoomLevels: plan.levels.length,
    totalTiles,
    levels,
    minZoom: plan.minZoom,
    maxZoom: plan.maxZoom,
  };

  if (options.dryRun) {
    return result;
  }

  // Distinct canvases: 1x per level, plus one extra retina canvas per level.
  const canvasPlans: CanvasPlan[] = [];
  for (const level of plan.levels) {
    canvasPlans.push({ zoom: level.zoom, canvas: level.canvas, resize: level.resize });
    if (options.retina) {
      const retinaZoom = level.zoom + 1;
      const retinaCanvas = canvasDimensions(retinaZoom, options.tileSize);
      canvasPlans.push({
        zoom: retinaZoom,
        canvas: retinaCanvas,
        resize: resizeForLevel(options.fit, dimensions, retinaCanvas, computedMaxZoom - retinaZoom),
      });
    }
  }
  const distinctCanvases = [...new Map(canvasPlans.map((c) => [c.zoom, c])).values()];

  for (const canvasPlan of distinctCanvases) {
    await io.renderCanvas(
      options.sourcePath,
      canvasPlan.canvas,
      canvasPlan.resize,
      color,
      canvasFilePath(options.targetPath, canvasPlan.zoom),
    );
  }

  const baseTileOptions: TileRenderOptions = {
    format: options.format,
    quality: options.quality,
    tms: options.tms,
    retina: false,
    concurrency: options.concurrency,
    skipExisting: options.skipExisting,
  };

  for (const level of plan.levels) {
    const grid = tileGrid(level.canvas, options.tileSize);
    const tiles = tileCoordinates(grid);
    await io.renderTiles(
      canvasFilePath(options.targetPath, level.zoom),
      tiles,
      level.zoom,
      options.tileSize,
      baseTileOptions,
      options.targetPath,
    );
    if (options.retina) {
      await io.renderTiles(
        canvasFilePath(options.targetPath, level.zoom + 1),
        tiles,
        level.zoom,
        options.tileSize * 2,
        { ...baseTileOptions, retina: true },
        options.targetPath,
      );
    }
  }

  if (!options.keepCanvas) {
    for (const canvasPlan of distinctCanvases) {
      io.removeFile(canvasFilePath(options.targetPath, canvasPlan.zoom));
    }
  }

  if (options.preview) {
    io.writeFile(join(options.targetPath, "index.html"), buildPreviewHtml(result, options));
  }
  if (options.metadata) {
    io.writeFile(join(options.targetPath, "tiles.json"), `${JSON.stringify(buildMetadata(result, options), null, 2)}\n`);
  }

  return result;
}
