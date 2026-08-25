/**
 * CLI layer: argument parsing (built-in `node:util` `parseArgs`), command
 * dispatch and top-level error handling.
 */

import { join } from "node:path";
import { parseArgs } from "node:util";
import packageJson from "../package.json" with { type: "json" };

import { cutTiles, type CutResult } from "./cutter.ts";
import { expandSourcePaths } from "./glob.ts";
import { createImageIO } from "./image.ts";
import { outputDirName } from "./paths.ts";
import { createProgressReporter, createSilentProgressReporter } from "./progress.ts";
import {
  parseConcurrency,
  parseFit,
  parseFormat,
  parseQuality,
  parseTileSize,
  parseZoom,
} from "./validation.ts";
import type { CutOptions, ImageIO } from "./types.ts";

/** Result of parsing the command line — a plain discriminated union. */
export type CliCommand =
  | { kind: "run"; options: CutOptions; quiet: boolean }
  | { kind: "help" }
  | { kind: "version"; version: string };

export const USAGE = [
  "pmaptilescutter — cut an image into Leaflet/Google-Maps compatible map tiles",
  "",
  "Usage:",
  "  pmaptilescutter --sourcePath <image|glob|dir> --targetPath <dir> [options]",
  "",
  "Options:",
  "  --sourcePath <path>          Image (or glob/dir for batch) to cut (required)",
  "  --targetPath <path>          Destination directory for the tiles (required)",
  "  --tileSize <number>          Tile size in pixels (default: 256)",
  "  --minZoom <number>           Lowest zoom level (default: 0)",
  "  --maxZoom <number>           Highest zoom level (default: auto)",
  "  --format <png|jpeg|webp>     Tile output format (default: png)",
  "  --quality <0-100>            Encoder quality for lossy formats",
  "  --fit <contain|cover|fill>   How the image fits the canvas (default: contain)",
  "  --aspectRatioBarsColor <hex> Color of the aspect-ratio bars (default: #000000FF)",
  "  --tms                        Flip Y for TMS-compatible numbering",
  "  --concurrency <number>       Tiles to render in parallel (default: 1)",
  "  --skipExisting               Skip tiles that already exist",
  "  --keepCanvas                 Keep intermediate canvas images",
  "  --retina                     Also emit @2x retina tiles",
  "  --preview                    Write a Leaflet index.html preview",
  "  --metadata                   Write a tiles.json metadata file",
  "  --dryRun                     Print the plan without writing anything",
  "  --quiet                      Suppress progress and summary output",
  "  -h, --help                   Show this help",
  "  --version                    Show the version",
].join("\n");

/** Parse and validate CLI arguments into a `CliCommand`. */
export function parseCliArgs(argv: string[]): CliCommand {
  const { values } = parseArgs({
    args: argv,
    options: {
      sourcePath: { type: "string" },
      targetPath: { type: "string" },
      tileSize: { type: "string", default: "256" },
      aspectRatioBarsColor: { type: "string", default: "#000000FF" },
      minZoom: { type: "string", default: "0" },
      maxZoom: { type: "string" },
      format: { type: "string", default: "png" },
      quality: { type: "string" },
      fit: { type: "string", default: "contain" },
      tms: { type: "boolean", default: false },
      concurrency: { type: "string", default: "1" },
      skipExisting: { type: "boolean", default: false },
      keepCanvas: { type: "boolean", default: false },
      retina: { type: "boolean", default: false },
      preview: { type: "boolean", default: false },
      metadata: { type: "boolean", default: false },
      dryRun: { type: "boolean", default: false },
      quiet: { type: "boolean", default: false },
      help: { type: "boolean", short: "h", default: false },
      version: { type: "boolean", default: false },
    },
  });

  if (values.help === true) {
    return { kind: "help" };
  }
  if (values.version === true) {
    return { kind: "version", version: packageJson.version };
  }
  if (values.sourcePath === undefined) {
    throw new Error('Missing required option: "--sourcePath"');
  }
  if (values.targetPath === undefined) {
    throw new Error('Missing required option: "--targetPath"');
  }

  const options: CutOptions = {
    sourcePath: values.sourcePath,
    targetPath: values.targetPath,
    tileSize: parseTileSize(values.tileSize),
    aspectRatioBarsColor: values.aspectRatioBarsColor,
    minZoom: parseZoom(values.minZoom),
    maxZoom: values.maxZoom === undefined ? undefined : parseZoom(values.maxZoom),
    format: parseFormat(values.format),
    quality: values.quality === undefined ? undefined : parseQuality(values.quality),
    tms: values.tms,
    concurrency: parseConcurrency(values.concurrency),
    skipExisting: values.skipExisting,
    keepCanvas: values.keepCanvas,
    fit: parseFit(values.fit),
    retina: values.retina,
    preview: values.preview,
    metadata: values.metadata,
    dryRun: values.dryRun,
  };

  return { kind: "run", options, quiet: values.quiet };
}

/** Execute a parsed command; returns the per-source cut summaries. */
export async function runCommand(command: CliCommand, io: ImageIO): Promise<CutResult[]> {
  if (command.kind === "help") {
    console.log(USAGE);
    return [];
  }
  if (command.kind === "version") {
    console.log(command.version);
    return [];
  }

  const sources = expandSourcePaths(command.options.sourcePath);
  const results: CutResult[] = [];
  for (const source of sources) {
    const target = sources.length === 1 ? command.options.targetPath : join(command.options.targetPath, outputDirName(source));
    results.push(await cutTiles({ ...command.options, sourcePath: source, targetPath: target }, io));
  }
  return results;
}

/** Entry point: parses, dispatches and maps the outcome to an exit code. */
export async function main(argv: string[], io?: ImageIO): Promise<number> {
  try {
    const command = parseCliArgs(argv);
    const quiet = command.kind === "run" && command.quiet;
    const effectiveIo = io ?? createImageIO(quiet ? createSilentProgressReporter() : createProgressReporter());

    const results = await runCommand(command, effectiveIo);
    if (!quiet && results.length > 0) {
      const totalTiles = results.reduce((sum, result) => sum + result.totalTiles, 0);
      console.log(
        `Tiles generation finished — ${results.length} source(s), ${results[0].zoomLevels} zoom levels, ${totalTiles} tiles total.`,
      );
    }
    return 0;
  } catch (error) {
    console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
    return 1;
  }
}
