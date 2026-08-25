/**
 * Data contracts for the map-tile cutter.
 *
 * This module holds only plain data shapes and behavior contracts. It has no
 * runtime imports so the rest of the codebase can depend on it without pulling
 * in side effects — the core of the data-oriented design.
 */

/** Output image format for tiles. */
export type TileFormat = "png" | "jpeg" | "webp";

/** How a non-square source image is fitted onto the square canvas. */
export type FitMode = "contain" | "cover" | "fill";

/** sharp `fit` value used when resizing the source onto a canvas. */
export type ResizeFit = "cover" | "fill";

/** Options that drive a single cut run (already resolved/defaulted). */
export interface CutOptions {
  /** Path to the source image (may be a glob for batch runs). */
  sourcePath: string;
  /** Directory where the generated tiles are written. */
  targetPath: string;
  /** Edge length of a single tile in pixels. */
  tileSize: number;
  /** Hex color for the aspect-ratio bars, e.g. `#000000FF`. */
  aspectRatioBarsColor: string;
  /** Lowest zoom level to generate. */
  minZoom: number;
  /** Highest zoom level to generate; `undefined` = auto from image size. */
  maxZoom?: number;
  /** Tile output format. */
  format: TileFormat;
  /** Encoder quality (0..100). */
  quality?: number;
  /** Flip the Y axis for TMS-compatible tile numbering. */
  tms: boolean;
  /** Number of tiles to render in parallel. */
  concurrency: number;
  /** Skip tiles that already exist on disk. */
  skipExisting: boolean;
  /** Keep the intermediate canvas images (default deletes them). */
  keepCanvas: boolean;
  /** How the image is fitted onto the canvas. */
  fit: FitMode;
  /** Also emit `@2x` retina tiles at double resolution. */
  retina: boolean;
  /** Write a Leaflet `index.html` preview. */
  preview: boolean;
  /** Write a `tiles.json` metadata file. */
  metadata: boolean;
  /** Compute and report the plan without writing anything. */
  dryRun: boolean;
}

/** Width/height of an image in pixels. */
export interface ImageDimensions {
  width: number;
  height: number;
}

/** An RGBA color with alpha in the `0..1` range. */
export interface RgbaColor {
  red: number;
  green: number;
  blue: number;
  alpha: number;
}

/** A 2D offset in pixels. */
export interface Offset {
  left: number;
  top: number;
}

/** How the source image is resized and positioned on a canvas. */
export interface ResizeSpec {
  width: number;
  height: number;
  fit: ResizeFit;
  offset: Offset;
}

/** Everything needed to render one zoom level. */
export interface ZoomLevelPlan {
  zoom: number;
  canvas: ImageDimensions;
  resize: ResizeSpec;
}

/** The full plan of zoom levels for a source image. */
export interface ZoomPlan {
  levels: ZoomLevelPlan[];
  minZoom: number;
  maxZoom: number;
  computedMaxZoom: number;
}

/** How a canvas is divided into a grid of tiles. */
export interface TileGrid {
  columns: number;
  rows: number;
  total: number;
}

/** A single tile identified by its grid position (x column, y row). */
export interface TileCoordinate {
  x: number;
  y: number;
}

/** Per-level summary of what was generated. */
export interface LevelSummary {
  zoom: number;
  columns: number;
  rows: number;
  tileCount: number;
}

/** Summary returned by a successful cut. */
export interface CutResult {
  source: ImageDimensions;
  zoomLevels: number;
  totalTiles: number;
  levels: LevelSummary[];
  minZoom: number;
  maxZoom: number;
}

/** Minimal progress bar abstraction (kept injectable for tests). */
export interface ProgressReporter {
  start(total: number): void;
  update(current: number): void;
  stop(): void;
}

/** Everything renderTiles needs beyond the level/tile data itself. */
export interface TileRenderOptions {
  format: TileFormat;
  quality?: number;
  tms: boolean;
  retina: boolean;
  concurrency: number;
  skipExisting: boolean;
}

/**
 * All filesystem/image side effects used by the cutter. Implemented for real
 * with `sharp` in `image.ts`, faked in unit tests.
 */
export interface ImageIO {
  ensureDirectory(path: string): void;
  fileExists(path: string): boolean;
  removeFile(path: string): void;
  writeFile(path: string, content: string): void;
  readDimensions(sourcePath: string): Promise<ImageDimensions>;
  renderCanvas(sourcePath: string, canvas: ImageDimensions, resize: ResizeSpec, color: RgbaColor, outputPath: string): Promise<void>;
  renderTiles(canvasPath: string, tiles: TileCoordinate[], zoom: number, tileSize: number, options: TileRenderOptions, targetPath: string): Promise<void>;
}
