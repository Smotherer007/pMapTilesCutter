/**
 * Progress reporting. Kept behind a tiny interface so the rest of the code
 * never depends on `cli-progress` directly and tests can inject a silent one.
 */

import cliProgress from "cli-progress";
import type { ProgressReporter } from "./types.ts";

/** Real terminal progress bar backed by `cli-progress`. */
export function createProgressReporter(): ProgressReporter {
  const bar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);
  return {
    start: (total) => bar.start(total, 0),
    update: (current) => bar.update(current),
    stop: () => bar.stop(),
  };
}

/** No-op reporter used in tests and non-interactive runs. */
export function createSilentProgressReporter(): ProgressReporter {
  return {
    start: () => {},
    update: () => {},
    stop: () => {},
  };
}
