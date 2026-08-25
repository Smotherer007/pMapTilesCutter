import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { createProgressReporter, createSilentProgressReporter } from "../src/progress.ts";

describe("createSilentProgressReporter", () => {
  it("exposes start/update/stop without side effects", () => {
    const reporter = createSilentProgressReporter();
    assert.doesNotThrow(() => {
      reporter.start(10);
      reporter.update(5);
      reporter.stop();
    });
  });
});

describe("createProgressReporter", () => {
  it("runs a full start/update/stop cycle", () => {
    const reporter = createProgressReporter();
    assert.doesNotThrow(() => {
      reporter.start(2);
      reporter.update(1);
      reporter.update(2);
      reporter.stop();
    });
  });
});
