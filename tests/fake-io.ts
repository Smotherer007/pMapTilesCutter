/**
 * Reusable fake I/O backend for unit tests (no filesystem, no sharp).
 */

import type {
  ImageDimensions,
  ImageIO,
  RgbaColor,
  ResizeSpec,
  TileCoordinate,
  TileRenderOptions,
} from "../src/types.ts";

export interface FakeImageIO extends ImageIO {
  calls: {
    ensureDirectory: string[];
    fileExists: string[];
    removeFile: string[];
    writeFile: Array<{ path: string; content: string }>;
    readDimensions: string[];
    renderCanvas: Array<{ sourcePath: string; canvas: ImageDimensions; resize: ResizeSpec; color: RgbaColor; outputPath: string }>;
    renderTiles: Array<{ canvasPath: string; tiles: TileCoordinate[]; zoom: number; tileSize: number; options: TileRenderOptions; targetPath: string }>;
  };
  setDimensions(dimensions: ImageDimensions): void;
}

/** A fake that records every call and returns the given dimensions. */
export function createFakeImageIO(dimensions: ImageDimensions): FakeImageIO {
  const calls: FakeImageIO["calls"] = {
    ensureDirectory: [],
    fileExists: [],
    removeFile: [],
    writeFile: [],
    readDimensions: [],
    renderCanvas: [],
    renderTiles: [],
  };

  let currentDimensions = dimensions;

  return {
    calls,
    setDimensions: (d) => {
      currentDimensions = d;
    },
    ensureDirectory: (path) => {
      calls.ensureDirectory.push(path);
    },
    fileExists: (path) => {
      calls.fileExists.push(path);
      return false;
    },
    removeFile: (path) => {
      calls.removeFile.push(path);
    },
    writeFile: (path, content) => {
      calls.writeFile.push({ path, content });
    },
    readDimensions: async (sourcePath) => {
      calls.readDimensions.push(sourcePath);
      return currentDimensions;
    },
    renderCanvas: async (sourcePath, canvas, resize, color, outputPath) => {
      calls.renderCanvas.push({ sourcePath, canvas, resize, color, outputPath });
    },
    renderTiles: async (canvasPath, tiles, zoom, tileSize, options, targetPath) => {
      calls.renderTiles.push({ canvasPath, tiles, zoom, tileSize, options, targetPath });
    },
  };
}

/** A fake that throws the given value on every operation. */
export function createThrowingImageIO(error: unknown): ImageIO {
  return {
    ensureDirectory: () => {
      throw error;
    },
    fileExists: () => {
      throw error;
    },
    removeFile: () => {
      throw error;
    },
    writeFile: () => {
      throw error;
    },
    readDimensions: async () => {
      throw error;
    },
    renderCanvas: async () => {
      throw error;
    },
    renderTiles: async () => {
      throw error;
    },
  };
}
