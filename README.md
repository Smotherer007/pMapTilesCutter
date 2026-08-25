# pMapTilesCutter

Cut any image into [Leaflet](https://leafletjs.com/) or [Google Maps](https://developers.google.com/maps)
compatible map tiles across multiple zoom levels.

Inspired by
[photoshop-google-maps-tile-cutter](https://github.com/bramus/photoshop-google-maps-tile-cutter).

## Requirements

- **Node.js >= 26** — the tool runs TypeScript natively via Node's built-in type
  stripping, so there is no build step and no `typescript` package to install.

## Usage

```bash
npx pmaptilescutter --sourcePath ./map.png --targetPath ./mymaptiles/
```

Or install it globally:

```bash
npm install --global pmaptilescutter
pmaptilescutter --sourcePath ./map.png --targetPath ./mymaptiles/
```

### Batch

`--sourcePath` also accepts a **glob** (`*` / `**`) or a **directory** of images.
Each source is written into its own sub-directory:

```bash
pmaptilescutter --sourcePath './maps/*.png' --targetPath ./tiles/
# -> tiles/map-a/..., tiles/map-b/...
```

### Options

| Option                   | Description                                                                    | Default      |
| ------------------------ | ------------------------------------------------------------------------------ | ------------ |
| `--sourcePath <path>`    | Image (or glob/dir for batch) to cut. **Required.**                            | —            |
| `--targetPath <path>`    | Directory where the tiles are written. **Required.**                           | —            |
| `--tileSize <number>`    | Edge length of a single tile in pixels.                                        | `256`        |
| `--minZoom <number>`     | Lowest zoom level to generate.                                                 | `0`          |
| `--maxZoom <number>`     | Highest zoom level to generate (auto by default).                              | auto         |
| `--format <fmt>`         | Tile format: `png`, `jpeg` or `webp`.                                          | `png`        |
| `--quality <0-100>`      | Encoder quality for `jpeg`/`webp` (and palette `png`).                         | —            |
| `--fit <mode>`           | How the image fits the canvas: `contain`, `cover` or `fill`.                   | `contain`    |
| `--aspectRatioBarsColor` | Color of the aspect-ratio bars as hex (`#000000FF` = opaque black).            | `#000000FF`  |
| `--tms`                  | Flip the Y axis for TMS-compatible numbering.                                  | off          |
| `--concurrency <number>` | Tiles to render in parallel.                                                   | `1`          |
| `--skipExisting`         | Skip tiles that already exist (resume).                                        | off          |
| `--keepCanvas`           | Keep the intermediate canvas images (deleted by default).                      | off          |
| `--retina`               | Also emit `@2x` retina tiles at double resolution.                             | off          |
| `--preview`              | Write a Leaflet `index.html` preview viewer.                                   | off          |
| `--metadata`             | Write a `tiles.json` metadata file.                                            | off          |
| `--dryRun`               | Print the zoom plan and tile count without writing anything.                   | off          |
| `--quiet`                | Suppress the progress bar and summary output.                                  | off          |
| `-h, --help`             | Show help.                                                                     | —            |
| `--version`              | Show the version.                                                              | —            |

## Output layout

Tiles are written as `{zoom}/{x}/{y}.{ext}` (the standard slippy-map layout used
by Leaflet and Google Maps), or `{zoom}/{x}/{y}.{ext}` with flipped `y` when
`--tms` is enabled. Retina tiles use an `@2x` suffix.

## Architecture

The code follows a **data-oriented** style: plain, immutable data shapes live in
`src/types.ts`, pure transformations in the `geometry`/`paths`/`color`/
`validation`/`export`/`async`/`glob` modules, while all filesystem/image side
effects are isolated in `src/image.ts` behind the `ImageIO` contract.
`src/cutter.ts` coordinates the two without doing I/O itself.

```
src/
├── types.ts       # data shapes + behavior contracts
├── geometry.ts    # pure zoom/tile math (fit modes, TMS)
├── paths.ts       # pure output-path builders
├── color.ts       # pure hex-color parsing
├── validation.ts  # pure input validation
├── async.ts       # concurrency limiter
├── glob.ts        # source-path expansion (glob/dir)
├── export.ts      # pure preview/metadata builders
├── progress.ts    # progress bar (cli-progress wrapper)
├── image.ts       # sharp/fs effects (the only I/O)
├── cutter.ts      # orchestration
└── cli.ts         # node:util parseArgs + command dispatch
```

## Development

```bash
npm install
npm test          # node:test with 100% coverage over src/
npm start -- --sourcePath ./map.png --targetPath ./mymaptiles/
```

## Releasing

Releases are automated with
[semantic-release](https://semantic-release.gitbook.io/) on every push to `main`
(or `next` for pre-releases). Use [Conventional Commits](https://www.conventionalcommits.org/)
(`feat:`, `fix:`, `BREAKING CHANGE:`) in your commit messages so the next
version is derived automatically and published to npm.
