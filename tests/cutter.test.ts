import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";

import { cutTiles } from "../src/cutter.ts";
import { canvasFilePath } from "../src/paths.ts";
import type { CutOptions } from "../src/types.ts";
import { createFakeImageIO, createThrowingImageIO } from "./fake-io.ts";

function options(overrides: Partial<CutOptions> = {}): CutOptions {
  return {
    sourcePath: "map.png",
    targetPath: "out",
    tileSize: 256,
    aspectRatioBarsColor: "#000000FF",
    minZoom: 0,
    maxZoom: undefined,
    format: "png",
    quality: undefined,
    tms: false,
    concurrency: 1,
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

describe("cutTiles", () => {
  it("plans zoom levels and drives the I/O backend in order", async () => {
    const io = createFakeImageIO({ width: 100, height: 50 });
    const result = await cutTiles(options(), io);

    assert.deepEqual(result, {
      source: { width: 100, height: 50 },
      zoomLevels: 2,
      totalTiles: 5,
      levels: [
        { zoom: 0, columns: 1, rows: 1, tileCount: 1 },
        { zoom: 1, columns: 2, rows: 2, tileCount: 4 },
      ],
      minZoom: 0,
      maxZoom: 1,
    });

    assert.deepEqual(io.calls.ensureDirectory, ["out"]);
    assert.deepEqual(io.calls.readDimensions, ["map.png"]);

    assert.deepEqual(
      io.calls.renderCanvas.map((c) => c.outputPath),
      [canvasFilePath("out", 0), canvasFilePath("out", 1)],
    );
    assert.deepEqual(
      io.calls.renderTiles.map((t) => t.zoom),
      [0, 1],
    );
    assert.equal(io.calls.renderTiles[0].tiles.length, 1);
    assert.equal(io.calls.renderTiles[1].tiles.length, 4);
    assert.deepEqual(
      io.calls.removeFile,
      [canvasFilePath("out", 0), canvasFilePath("out", 1)],
    );
    assert.equal(io.calls.writeFile.length, 0);
  });

  it("honors an explicit maxZoom", async () => {
    const io = createFakeImageIO({ width: 100, height: 50 });
    const result = await cutTiles(options({ maxZoom: 0 }), io);
    assert.equal(result.zoomLevels, 1);
    assert.equal(result.maxZoom, 0);
    assert.equal(io.calls.renderCanvas.length, 1);
  });

  it("renders retina canvases and doubled tiles when enabled", async () => {
    const io = createFakeImageIO({ width: 100, height: 50 });
    const result = await cutTiles(options({ retina: true }), io);

    assert.equal(result.totalTiles, 10);
    assert.deepEqual(
      io.calls.renderCanvas.map((c) => c.outputPath),
      [canvasFilePath("out", 0), canvasFilePath("out", 1), canvasFilePath("out", 2)],
    );
    // 1x + retina per level
    assert.equal(io.calls.renderTiles.length, 4);
    assert.equal(io.calls.renderTiles[0].tileSize, 256);
    assert.equal(io.calls.renderTiles[0].options.retina, false);
    assert.equal(io.calls.renderTiles[1].tileSize, 512);
    assert.equal(io.calls.renderTiles[1].options.retina, true);
  });

  it("keeps canvases when keepCanvas is set", async () => {
    const io = createFakeImageIO({ width: 100, height: 50 });
    await cutTiles(options({ keepCanvas: true }), io);
    assert.equal(io.calls.removeFile.length, 0);
  });

  it("writes preview and metadata files when requested", async () => {
    const io = createFakeImageIO({ width: 100, height: 50 });
    await cutTiles(options({ preview: true, metadata: true }), io);

    const paths = io.calls.writeFile.map((w) => w.path);
    assert.ok(paths.includes(join("out", "index.html")));
    assert.ok(paths.includes(join("out", "tiles.json")));
  });

  it("computes the plan without rendering in dry-run mode", async () => {
    const io = createFakeImageIO({ width: 100, height: 50 });
    const result = await cutTiles(options({ dryRun: true }), io);

    assert.equal(result.totalTiles, 5);
    assert.equal(io.calls.renderCanvas.length, 0);
    assert.equal(io.calls.renderTiles.length, 0);
    assert.equal(io.calls.removeFile.length, 0);
    assert.equal(io.calls.writeFile.length, 0);
  });

  it("passes format, quality, tms, concurrency and skipExisting through", async () => {
    const io = createFakeImageIO({ width: 100, height: 50 });
    await cutTiles(
      options({ format: "webp", quality: 80, tms: true, concurrency: 4, skipExisting: true }),
      io,
    );

    const tileOptions = io.calls.renderTiles[0].options;
    assert.equal(tileOptions.format, "webp");
    assert.equal(tileOptions.quality, 80);
    assert.equal(tileOptions.tms, true);
    assert.equal(tileOptions.concurrency, 4);
    assert.equal(tileOptions.skipExisting, true);
  });

  it("propagates errors from the I/O backend", async () => {
    const io = createThrowingImageIO(new Error("boom"));
    await assert.rejects(cutTiles(options(), io), /boom/);
  });
});
