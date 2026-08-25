import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";

import { cutTiles } from "../src/cutter.ts";
import { buildZoomPlan, tileCoordinates, tileGrid } from "../src/geometry.ts";
import {
  createImageIO,
  dimensionsFromMetadata,
  ensureDirectory,
  fileExists,
  readImageDimensions,
  removeFile,
  renderCanvas,
  renderTiles,
  writeFile,
} from "../src/image.ts";
import { createSilentProgressReporter } from "../src/progress.ts";
import type { CutOptions, RgbaColor } from "../src/types.ts";

const RED: RgbaColor = { red: 255, green: 0, blue: 0, alpha: 1 };

function tempDir(): string {
  return mkdtempSync(join(tmpdir(), "pmaptilescutter-"));
}

async function makeSource(dir: string, width = 100, height = 50): Promise<string> {
  const sourcePath = join(dir, "source.png");
  await sharp({
    create: { width, height, channels: 4, background: { r: 255, g: 0, b: 0, alpha: 1 } },
  })
    .png()
    .toFile(sourcePath);
  return sourcePath;
}

async function pixelColor(path: string): Promise<{ r: number; g: number; b: number }> {
  const { data } = await sharp(path)
    .extract({ left: 0, top: 0, width: 1, height: 1 })
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { r: data[0], g: data[1], b: data[2] };
}

describe("pure helpers", () => {
  describe("dimensionsFromMetadata", () => {
    it("returns width and height when both are present", () => {
      assert.deepEqual(dimensionsFromMetadata({ width: 10, height: 20 }), { width: 10, height: 20 });
    });

    it("throws when width or height is missing", () => {
      assert.throws(() => dimensionsFromMetadata({ height: 20 }), /Could not determine image dimensions/);
      assert.throws(() => dimensionsFromMetadata({ width: 10 }), /Could not determine image dimensions/);
    });
  });
});

describe("filesystem helpers", () => {
  it("ensureDirectory creates nested directories and is idempotent", () => {
    const dir = tempDir();
    try {
      const nested = join(dir, "a", "b", "c");
      assert.equal(existsSync(nested), false);
      ensureDirectory(nested);
      assert.equal(existsSync(nested), true);
      assert.doesNotThrow(() => ensureDirectory(nested));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("fileExists, removeFile and writeFile work together", () => {
    const dir = tempDir();
    try {
      const file = join(dir, "sub", "f.txt");
      writeFile(file, "hello");
      assert.equal(fileExists(file), true);
      assert.equal(readFileSync(file, "utf8"), "hello");
      removeFile(file);
      assert.equal(fileExists(file), false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("image rendering (integration with sharp)", () => {
  it("reads image dimensions", async () => {
    const dir = tempDir();
    try {
      const source = await makeSource(dir);
      assert.deepEqual(await readImageDimensions(source), { width: 100, height: 50 });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("renders a contain canvas with bars", async () => {
    const dir = tempDir();
    try {
      const source = await makeSource(dir);
      const level = buildZoomPlan({ width: 100, height: 50 }, 256, { minZoom: 0, maxZoom: 0, fit: "contain" }).levels[0];
      const out = join(dir, "canvas.png");
      await renderCanvas(source, level.canvas, level.resize, RED, out);

      const meta = await sharp(out).metadata();
      assert.equal(meta.width, 256);
      assert.equal(meta.height, 256);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("renders cover and fill canvases at the canvas size", async () => {
    const dir = tempDir();
    try {
      const source = await makeSource(dir);
      for (const fit of ["cover", "fill"] as const) {
        const level = buildZoomPlan({ width: 100, height: 50 }, 256, { minZoom: 0, maxZoom: 0, fit }).levels[0];
        const out = join(dir, `canvas-${fit}.png`);
        await renderCanvas(source, level.canvas, level.resize, RED, out);
        const meta = await sharp(out).metadata();
        assert.equal(meta.width, 256);
        assert.equal(meta.height, 256);
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("cuts a canvas into png tiles", async () => {
    const dir = tempDir();
    try {
      const source = await makeSource(dir, 512, 512);
      const level = buildZoomPlan({ width: 512, height: 512 }, 256, { minZoom: 1, maxZoom: 1, fit: "contain" }).levels[0];
      const canvas = join(dir, "canvas_1.png");
      await renderCanvas(source, level.canvas, level.resize, RED, canvas);

      const tiles = tileCoordinates(tileGrid(level.canvas, 256));
      await renderTiles(canvas, tiles, 1, 256, { format: "png", tms: false, retina: false, concurrency: 1, skipExisting: false }, dir, createSilentProgressReporter());

      assert.equal(existsSync(join(dir, "1", "0", "0.png")), true);
      assert.equal(existsSync(join(dir, "1", "1", "1.png")), true);
      const meta = await sharp(join(dir, "1", "0", "0.png")).metadata();
      assert.equal(meta.width, 256);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("renders jpeg and webp tiles", async () => {
    const dir = tempDir();
    try {
      const source = await makeSource(dir, 256, 256);
      const level = buildZoomPlan({ width: 256, height: 256 }, 256, { minZoom: 0, maxZoom: 0, fit: "contain" }).levels[0];
      const canvas = join(dir, "canvas_0.png");
      await renderCanvas(source, level.canvas, level.resize, RED, canvas);
      const tiles = tileCoordinates(tileGrid(level.canvas, 256));

      await renderTiles(canvas, tiles, 0, 256, { format: "jpeg", quality: 80, tms: false, retina: false, concurrency: 1, skipExisting: false }, dir, createSilentProgressReporter());
      assert.equal(existsSync(join(dir, "0", "0", "0.jpg")), true);

      await renderTiles(canvas, tiles, 0, 256, { format: "webp", quality: 80, tms: false, retina: false, concurrency: 1, skipExisting: false }, dir, createSilentProgressReporter());
      assert.equal(existsSync(join(dir, "0", "0", "0.webp")), true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("renders jpeg/webp without quality and png with quality", async () => {
    const dir = tempDir();
    try {
      const source = await makeSource(dir, 256, 256);
      const level = buildZoomPlan({ width: 256, height: 256 }, 256, { minZoom: 0, maxZoom: 0, fit: "contain" }).levels[0];
      const canvas = join(dir, "canvas_0.png");
      await renderCanvas(source, level.canvas, level.resize, RED, canvas);
      const tiles = tileCoordinates(tileGrid(level.canvas, 256));

      await renderTiles(canvas, tiles, 0, 256, { format: "jpeg", tms: false, retina: false, concurrency: 1, skipExisting: false }, dir, createSilentProgressReporter());
      await renderTiles(canvas, tiles, 0, 256, { format: "webp", tms: false, retina: false, concurrency: 1, skipExisting: false }, dir, createSilentProgressReporter());
      await renderTiles(canvas, tiles, 0, 256, { format: "png", quality: 60, tms: false, retina: false, concurrency: 1, skipExisting: false }, dir, createSilentProgressReporter());

      assert.equal(existsSync(join(dir, "0", "0", "0.jpg")), true);
      assert.equal(existsSync(join(dir, "0", "0", "0.webp")), true);
      assert.equal(existsSync(join(dir, "0", "0", "0.png")), true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("flips the Y axis for TMS tiles", async () => {
    const dir = tempDir();
    try {
      // top half red, bottom half blue
      const source = join(dir, "source.png");
      await sharp({ create: { width: 512, height: 512, channels: 4, background: { r: 0, g: 0, b: 255, alpha: 1 } } })
        .composite([{ input: await sharp({ create: { width: 512, height: 256, channels: 4, background: { r: 255, g: 0, b: 0, alpha: 1 } } }).png().toBuffer(), top: 0, left: 0 }])
        .png()
        .toFile(source);

      const level = buildZoomPlan({ width: 512, height: 512 }, 256, { minZoom: 1, maxZoom: 1, fit: "contain" }).levels[0];
      const canvas = join(dir, "canvas_1.png");
      await renderCanvas(source, level.canvas, level.resize, RED, canvas);
      const tiles = tileCoordinates(tileGrid(level.canvas, 256));

      await renderTiles(canvas, tiles, 1, 256, { format: "png", tms: true, retina: false, concurrency: 1, skipExisting: false }, dir, createSilentProgressReporter());

      // Without tms, tile (0,0) is red. With tms, file 1/0/0.png holds tile (0,1) = blue.
      const color = await pixelColor(join(dir, "1", "0", "0.png"));
      assert.equal(color.b, 255);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("renders retina (@2x) tiles at double resolution", async () => {
    const dir = tempDir();
    try {
      const source = await makeSource(dir, 1024, 1024);
      const level = buildZoomPlan({ width: 1024, height: 1024 }, 512, { minZoom: 1, maxZoom: 1, fit: "contain" }).levels[0];
      const canvas = join(dir, "canvas.png");
      await renderCanvas(source, level.canvas, level.resize, RED, canvas);

      const tiles = tileCoordinates(tileGrid({ width: 1024, height: 1024 }, 512));
      await renderTiles(canvas, tiles, 1, 512, { format: "png", tms: false, retina: true, concurrency: 1, skipExisting: false }, dir, createSilentProgressReporter());

      const out = join(dir, "1", "0", "0@2x.png");
      assert.equal(existsSync(out), true);
      const meta = await sharp(out).metadata();
      assert.equal(meta.width, 512);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("skips existing tiles when skipExisting is on", async () => {
    const dir = tempDir();
    try {
      const source = await makeSource(dir, 256, 256);
      const level = buildZoomPlan({ width: 256, height: 256 }, 256, { minZoom: 0, maxZoom: 0, fit: "contain" }).levels[0];
      const canvas = join(dir, "canvas_0.png");
      await renderCanvas(source, level.canvas, level.resize, RED, canvas);

      const existing = join(dir, "0", "0", "0.png");
      ensureDirectory(join(dir, "0", "0"));
      writeFileSync(existing, "sentinel");

      const tiles = tileCoordinates(tileGrid(level.canvas, 256));
      await renderTiles(canvas, tiles, 0, 256, { format: "png", tms: false, retina: false, concurrency: 1, skipExisting: true }, dir, createSilentProgressReporter());

      assert.equal(readFileSync(existing, "utf8"), "sentinel");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("renders all tiles when skipExisting is on but nothing exists", async () => {
    const dir = tempDir();
    try {
      const source = await makeSource(dir, 512, 512);
      const level = buildZoomPlan({ width: 512, height: 512 }, 256, { minZoom: 1, maxZoom: 1, fit: "contain" }).levels[0];
      const canvas = join(dir, "canvas_1.png");
      await renderCanvas(source, level.canvas, level.resize, RED, canvas);

      const tiles = tileCoordinates(tileGrid(level.canvas, 256));
      await renderTiles(canvas, tiles, 1, 256, { format: "png", tms: false, retina: false, concurrency: 1, skipExisting: true }, dir, createSilentProgressReporter());

      assert.equal(existsSync(join(dir, "1", "0", "0.png")), true);
      assert.equal(existsSync(join(dir, "1", "1", "1.png")), true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("renders tiles with concurrency > 1", async () => {
    const dir = tempDir();
    try {
      const source = await makeSource(dir, 512, 512);
      const level = buildZoomPlan({ width: 512, height: 512 }, 256, { minZoom: 1, maxZoom: 1, fit: "contain" }).levels[0];
      const canvas = join(dir, "canvas_1.png");
      await renderCanvas(source, level.canvas, level.resize, RED, canvas);

      const tiles = tileCoordinates(tileGrid(level.canvas, 256));
      await renderTiles(canvas, tiles, 1, 256, { format: "png", tms: false, retina: false, concurrency: 4, skipExisting: false }, dir, createSilentProgressReporter());

      assert.equal(existsSync(join(dir, "1", "0", "0.png")), true);
      assert.equal(existsSync(join(dir, "1", "1", "1.png")), true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("cutTiles end-to-end", () => {
  function options(overrides: Partial<CutOptions> = {}): CutOptions {
    return {
      sourcePath: "",
      targetPath: "",
      tileSize: 256,
      aspectRatioBarsColor: "#000000FF",
      minZoom: 0,
      maxZoom: undefined,
      format: "png",
      quality: undefined,
      tms: false,
      concurrency: 2,
      skipExisting: false,
      keepCanvas: false,
      fit: "contain",
      retina: false,
      preview: false,
      metadata: false,
      dryRun: false,
      ...overrides,
    };
  }

  it("runs a full cut with webp, tms, retina, preview and metadata", async () => {
    const dir = tempDir();
    try {
      const source = await makeSource(dir, 512, 512);
      const target = join(dir, "out");
      const io = createImageIO(createSilentProgressReporter());

      const result = await cutTiles(
        options({
          sourcePath: source,
          targetPath: target,
          format: "webp",
          tms: true,
          retina: true,
          preview: true,
          metadata: true,
        }),
        io,
      );

      // 512x512 -> computed maxZoom 1 (levels 0,1); retina doubles to 2+8=10 tiles
      assert.equal(result.totalTiles, 10);

      // canvases cleaned up
      assert.equal(existsSync(join(target, "canvas_0.png")), false);
      assert.equal(existsSync(join(target, "canvas_1.png")), false);
      assert.equal(existsSync(join(target, "canvas_2.png")), false);

      // 1x and retina webp tiles present
      assert.equal(existsSync(join(target, "0", "0", "0.webp")), true);
      assert.equal(existsSync(join(target, "0", "0", "0@2x.webp")), true);

      // preview + metadata
      assert.equal(existsSync(join(target, "index.html")), true);
      assert.equal(existsSync(join(target, "tiles.json")), true);
      const metadata = JSON.parse(readFileSync(join(target, "tiles.json"), "utf8"));
      assert.equal(metadata.tms, true);
      assert.equal(metadata.retina, true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
