import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { buildMetadata, buildPreviewHtml } from "../src/export.ts";
import type { CutOptions, CutResult } from "../src/types.ts";

function sampleResult(): CutResult {
  return {
    source: { width: 100, height: 50 },
    zoomLevels: 2,
    totalTiles: 5,
    levels: [
      { zoom: 0, columns: 1, rows: 1, tileCount: 1 },
      { zoom: 1, columns: 2, rows: 2, tileCount: 4 },
    ],
    minZoom: 0,
    maxZoom: 1,
  };
}

function sampleOptions(overrides: Partial<CutOptions> = {}): CutOptions {
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

describe("buildMetadata", () => {
  it("includes the key tile-set facts", () => {
    const metadata = buildMetadata(sampleResult(), sampleOptions({ format: "webp", tms: true, retina: true }));
    assert.equal(metadata.tileSize, 256);
    assert.equal(metadata.format, "webp");
    assert.equal(metadata.minZoom, 0);
    assert.equal(metadata.maxZoom, 1);
    assert.equal(metadata.tms, true);
    assert.equal(metadata.retina, true);
    assert.deepEqual(metadata.source, { width: 100, height: 50 });
    assert.equal(metadata.totalTiles, 5);
    assert.equal((metadata.levels as unknown[]).length, 2);
  });
});

describe("buildPreviewHtml", () => {
  it("references the tile URL with the right extension", () => {
    const html = buildPreviewHtml(sampleResult(), sampleOptions());
    assert.match(html, /\{z\}\/\{x\}\/\{y\}\.png/);
    assert.match(html, /L\.tileLayer/);
    assert.match(html, /const maxZoom = 1/);
    assert.match(html, /const minZoom = 0/);
  });

  it("uses the jpg extension for jpeg tiles", () => {
    const html = buildPreviewHtml(sampleResult(), sampleOptions({ format: "jpeg" }));
    assert.match(html, /\{z\}\/\{x\}\/\{y\}\.jpg/);
  });

  it("enables the tms option when tms is on", () => {
    const html = buildPreviewHtml(sampleResult(), sampleOptions({ tms: true }));
    assert.match(html, /tms: true/);
  });

  it("omits the tms option by default", () => {
    const html = buildPreviewHtml(sampleResult(), sampleOptions());
    assert.doesNotMatch(html, /tms: true/);
  });
});
