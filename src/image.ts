/**
 * Filesystem + image side effects, implemented with `sharp`. This is the only
 * module that performs I/O; everything else is pure data transformation.
 */

import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import sharp from "sharp";

import { mapWithConcurrency } from "./async.ts";
import { tmsY } from "./geometry.ts";
import { canvasFilePath, tileDirectory, tileFilePath } from "./paths.ts";
import type {
  ImageDimensions,
  ImageIO,
  ProgressReporter,
  ResizeSpec,
  RgbaColor,
  TileCoordinate,
  TileRenderOptions,
} from "./types.ts";

/** Coerce `sharp` metadata into `ImageDimensions`, rejecting missing values. */
export function dimensionsFromMetadata(metadata: { width?: number; height?: number }): ImageDimensions {
  if (metadata.width === undefined || metadata.height === undefined) {
    throw new Error("Could not determine image dimensions.");
  }
  return { width: metadata.width, height: metadata.height };
}

/** Create `path` (and parents) if it does not already exist. */
export function ensureDirectory(path: string): void {
  if (!existsSync(path)) {
    mkdirSync(path, { recursive: true });
  }
}

/** True when the path exists on disk. */
export function fileExists(path: string): boolean {
  return existsSync(path);
}

/** Remove a file, ignoring a missing path. */
export function removeFile(path: string): void {
  rmSync(path, { force: true });
}

/** Write text content to a file (creates parent directories). */
export function writeFile(path: string, content: string): void {
  ensureDirectory(dirname(path));
  writeFileSync(path, content);
}

/** Read the pixel dimensions of the source image. */
export async function readImageDimensions(sourcePath: string): Promise<ImageDimensions> {
  const metadata = await sharp(sourcePath).metadata();
  return dimensionsFromMetadata(metadata);
}

/** Render one canvas image (always lossless PNG) at `outputPath`. */
export async function renderCanvas(
  sourcePath: string,
  canvas: ImageDimensions,
  resize: ResizeSpec,
  color: RgbaColor,
  outputPath: string,
): Promise<void> {
  const resized = await sharp(sourcePath)
    .clone()
    .resize(resize.width, resize.height, { fit: resize.fit })
    .toBuffer();

  await sharp({
    create: {
      width: canvas.width,
      height: canvas.height,
      channels: 4,
      background: { r: color.red, g: color.green, b: color.blue, alpha: color.alpha },
    },
  })
    .composite([{ input: resized, left: resize.offset.left, top: resize.offset.top, blend: "over" }])
    .png()
    .toFile(outputPath);
}

/** Apply the target format + quality to a sharp pipeline. */
function encode(pipeline: sharp.Sharp, options: TileRenderOptions): sharp.Sharp {
  const quality = options.quality;
  switch (options.format) {
    case "jpeg":
      return quality === undefined ? pipeline.jpeg() : pipeline.jpeg({ quality });
    case "webp":
      return quality === undefined ? pipeline.webp() : pipeline.webp({ quality });
    case "png":
      return quality === undefined ? pipeline.png({ palette: true }) : pipeline.png({ palette: true, quality });
  }
}

/** Cut one canvas into its tiles, with optional parallelism and resume. */
export async function renderTiles(
  canvasPath: string,
  tiles: TileCoordinate[],
  zoom: number,
  tileSize: number,
  options: TileRenderOptions,
  targetPath: string,
  progress: ProgressReporter,
): Promise<void> {
  const canvas = sharp(canvasPath);
  progress.start(tiles.length);
  let completed = 0;

  await mapWithConcurrency(tiles, options.concurrency, async (tile) => {
    const outputY = options.tms ? tmsY(tile.y, zoom) : tile.y;
    const directory = tileDirectory(targetPath, zoom, tile.x);
    ensureDirectory(directory);
    const outputPath = tileFilePath(directory, outputY, options.format, options.retina);

    if (options.skipExisting && fileExists(outputPath)) {
      completed += 1;
      progress.update(completed);
      return;
    }

    await encode(
      canvas.clone().extract({ left: tile.x * tileSize, top: tile.y * tileSize, width: tileSize, height: tileSize }),
      options,
    ).toFile(outputPath);

    completed += 1;
    progress.update(completed);
  });

  progress.stop();
}

/** Build the real `ImageIO` with a chosen progress reporter. */
export function createImageIO(progress: ProgressReporter): ImageIO {
  return {
    ensureDirectory,
    fileExists,
    removeFile,
    writeFile,
    readDimensions: readImageDimensions,
    renderCanvas,
    renderTiles: (canvasPath, tiles, zoom, tileSize, options, targetPath) =>
      renderTiles(canvasPath, tiles, zoom, tileSize, options, targetPath, progress),
  };
}
