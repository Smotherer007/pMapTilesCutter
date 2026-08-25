import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  buildZoomPlan,
  canvasDimensions,
  centeredOffset,
  maxZoomLevel,
  resizeForLevel,
  scaleDimension,
  scaledImageDimensions,
  tileCoordinates,
  tileGrid,
  tmsY,
} from "../src/geometry.ts";
import type { ImageDimensions } from "../src/types.ts";

describe("scaleDimension", () => {
  it("keeps the dimension unchanged at scale 0", () => {
    assert.equal(scaleDimension(100, 0), 100);
  });

  it("halves at each scale step", () => {
    assert.equal(scaleDimension(100, 1), 50);
    assert.equal(scaleDimension(100, 2), 25);
    assert.equal(scaleDimension(100, 3), 13);
  });

  it("rounds up so no pixel is dropped", () => {
    assert.equal(scaleDimension(50, 1), 25);
    assert.equal(scaleDimension(51, 1), 26);
    assert.equal(scaleDimension(1, 3), 1);
  });
});

describe("canvasDimensions", () => {
  it("produces a square of tileSize * 2^zoom", () => {
    assert.deepEqual(canvasDimensions(0, 256), { width: 256, height: 256 });
    assert.deepEqual(canvasDimensions(1, 256), { width: 512, height: 512 });
    assert.deepEqual(canvasDimensions(2, 256), { width: 1024, height: 1024 });
  });

  it("respects a custom tile size", () => {
    assert.deepEqual(canvasDimensions(1, 512), { width: 1024, height: 1024 });
  });
});

describe("scaledImageDimensions", () => {
  it("scales both dimensions by the same factor", () => {
    const dimensions: ImageDimensions = { width: 100, height: 50 };
    assert.deepEqual(scaledImageDimensions(dimensions, 0), { width: 100, height: 50 });
    assert.deepEqual(scaledImageDimensions(dimensions, 1), { width: 50, height: 25 });
    assert.deepEqual(scaledImageDimensions(dimensions, 2), { width: 25, height: 13 });
  });
});

describe("centeredOffset", () => {
  it("centers with even leftover space", () => {
    const canvas: ImageDimensions = { width: 256, height: 256 };
    const image: ImageDimensions = { width: 100, height: 50 };
    assert.deepEqual(centeredOffset(canvas, image), { left: 78, top: 103 });
  });

  it("floors odd leftover space", () => {
    const canvas: ImageDimensions = { width: 256, height: 256 };
    const image: ImageDimensions = { width: 101, height: 51 };
    assert.deepEqual(centeredOffset(canvas, image), { left: 77, top: 102 });
  });

  it("returns zero offset when sizes match", () => {
    const canvas: ImageDimensions = { width: 256, height: 256 };
    assert.deepEqual(centeredOffset(canvas, canvas), { left: 0, top: 0 });
  });
});

describe("maxZoomLevel", () => {
  it("never goes below 1", () => {
    assert.equal(maxZoomLevel({ width: 100, height: 50 }, 256), 1);
    assert.equal(maxZoomLevel({ width: 256, height: 256 }, 256), 1);
  });

  it("grows logarithmically with the image size", () => {
    assert.equal(maxZoomLevel({ width: 257, height: 100 }, 256), 1);
    assert.equal(maxZoomLevel({ width: 513, height: 10 }, 256), 2);
    assert.equal(maxZoomLevel({ width: 1024, height: 1024 }, 256), 2);
    assert.equal(maxZoomLevel({ width: 1025, height: 1025 }, 256), 3);
  });
});

describe("resizeForLevel", () => {
  const source: ImageDimensions = { width: 100, height: 50 };
  const canvas: ImageDimensions = { width: 256, height: 256 };

  it("contain scales to fit and centers with bars", () => {
    assert.deepEqual(resizeForLevel("contain", source, canvas, 1), {
      width: 50,
      height: 25,
      fit: "fill",
      offset: { left: 103, top: 115 },
    });
  });

  it("cover fills the canvas via sharp crop", () => {
    assert.deepEqual(resizeForLevel("cover", source, canvas, 1), {
      width: 256,
      height: 256,
      fit: "cover",
      offset: { left: 0, top: 0 },
    });
  });

  it("fill stretches to the canvas", () => {
    assert.deepEqual(resizeForLevel("fill", source, canvas, 1), {
      width: 256,
      height: 256,
      fit: "fill",
      offset: { left: 0, top: 0 },
    });
  });
});

describe("buildZoomPlan", () => {
  it("builds one level per zoom from minZoom to maxZoom", () => {
    const plan = buildZoomPlan({ width: 100, height: 50 }, 256, { minZoom: 0, maxZoom: 1, fit: "contain" });
    assert.equal(plan.levels.length, 2);
    assert.equal(plan.computedMaxZoom, 1);
    assert.equal(plan.minZoom, 0);
    assert.equal(plan.maxZoom, 1);

    const [level0, level1] = plan.levels;
    assert.equal(level0.zoom, 0);
    assert.deepEqual(level0.canvas, { width: 256, height: 256 });
    assert.deepEqual(level0.resize.offset, { left: 103, top: 115 });

    assert.equal(level1.zoom, 1);
    assert.deepEqual(level1.canvas, { width: 512, height: 512 });
    assert.deepEqual(level1.resize.offset, { left: 206, top: 231 });
  });

  it("respects an explicit minZoom", () => {
    const plan = buildZoomPlan({ width: 100, height: 50 }, 256, { minZoom: 1, maxZoom: 1, fit: "contain" });
    assert.equal(plan.levels.length, 1);
    assert.equal(plan.levels[0].zoom, 1);
  });

  it("uses the fit mode for every level", () => {
    const plan = buildZoomPlan({ width: 100, height: 50 }, 256, { minZoom: 0, maxZoom: 1, fit: "cover" });
    for (const level of plan.levels) {
      assert.equal(level.resize.fit, "cover");
    }
  });

  it("throws on a negative minZoom", () => {
    assert.throws(
      () => buildZoomPlan({ width: 100, height: 50 }, 256, { minZoom: -1, maxZoom: 1, fit: "contain" }),
      /Invalid minZoom/,
    );
  });

  it("throws when maxZoom is below minZoom", () => {
    assert.throws(
      () => buildZoomPlan({ width: 100, height: 50 }, 256, { minZoom: 2, maxZoom: 1, fit: "contain" }),
      /Invalid maxZoom/,
    );
  });
});

describe("tileGrid", () => {
  it("divides a canvas into a grid of tiles", () => {
    assert.deepEqual(tileGrid({ width: 256, height: 256 }, 256), { columns: 1, rows: 1, total: 1 });
    assert.deepEqual(tileGrid({ width: 512, height: 512 }, 256), { columns: 2, rows: 2, total: 4 });
    assert.deepEqual(tileGrid({ width: 1024, height: 512 }, 256), { columns: 4, rows: 2, total: 8 });
  });
});

describe("tileCoordinates", () => {
  it("enumerates tiles in row-major order", () => {
    const grid = tileGrid({ width: 512, height: 512 }, 256);
    assert.deepEqual(tileCoordinates(grid), [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 0, y: 1 },
      { x: 1, y: 1 },
    ]);
  });

  it("returns an empty list for an empty grid", () => {
    assert.deepEqual(tileCoordinates({ columns: 0, rows: 0, total: 0 }), []);
  });
});

describe("tmsY", () => {
  it("flips Y for a 2x2 tile set at zoom 1", () => {
    assert.equal(tmsY(0, 1), 1);
    assert.equal(tmsY(1, 1), 0);
  });

  it("flips Y for a 4x4 tile set at zoom 2", () => {
    assert.equal(tmsY(0, 2), 3);
    assert.equal(tmsY(3, 2), 0);
  });
});
