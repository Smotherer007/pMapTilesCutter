import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { mapWithConcurrency } from "../src/async.ts";

describe("mapWithConcurrency", () => {
  it("maps all items and preserves order", async () => {
    const result = await mapWithConcurrency([1, 2, 3, 4], 2, async (n) => n * 2);
    assert.deepEqual(result, [2, 4, 6, 8]);
  });

  it("works with a limit of 1 (sequential)", async () => {
    const result = await mapWithConcurrency([1, 2, 3], 1, async (n) => n + 1);
    assert.deepEqual(result, [2, 3, 4]);
  });

  it("works when the limit exceeds the item count", async () => {
    const result = await mapWithConcurrency([1, 2], 10, async (n) => n);
    assert.deepEqual(result, [1, 2]);
  });

  it("returns an empty array for empty input", async () => {
    const result = await mapWithConcurrency([], 2, async () => "x");
    assert.deepEqual(result, []);
  });

  it("passes the index to the callback", async () => {
    const indices: number[] = [];
    await mapWithConcurrency(["a", "b", "c"], 3, async (_item, index) => {
      indices.push(index);
    });
    assert.deepEqual(indices, [0, 1, 2]);
  });

  it("does not run more tasks than the limit in parallel", async () => {
    let active = 0;
    let maxActive = 0;
    await mapWithConcurrency([1, 2, 3, 4, 5, 6], 2, async () => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await new Promise((resolve) => setTimeout(resolve, 5));
      active -= 1;
    });
    assert.ok(maxActive <= 2, `expected maxActive <= 2, got ${maxActive}`);
  });
});
