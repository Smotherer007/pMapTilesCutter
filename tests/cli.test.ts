import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import packageJson from "../package.json" with { type: "json" };

import { main, parseCliArgs, runCommand, USAGE } from "../src/cli.ts";
import { createFakeImageIO, createThrowingImageIO } from "./fake-io.ts";

describe("parseCliArgs", () => {
  it("parses a full argument set", () => {
    const command = parseCliArgs([
      "--sourcePath", "maps/*.png",
      "--targetPath", "out/",
      "--tileSize", "512",
      "--minZoom", "1",
      "--maxZoom", "3",
      "--format", "webp",
      "--quality", "80",
      "--fit", "cover",
      "--aspectRatioBarsColor", "#FF000080",
      "--concurrency", "4",
      "--tms",
      "--skipExisting",
      "--keepCanvas",
      "--retina",
      "--preview",
      "--metadata",
      "--dryRun",
      "--quiet",
    ]);

    assert.equal(command.kind, "run");
    if (command.kind === "run") {
      assert.equal(command.quiet, true);
      assert.equal(command.options.tileSize, 512);
      assert.equal(command.options.minZoom, 1);
      assert.equal(command.options.maxZoom, 3);
      assert.equal(command.options.format, "webp");
      assert.equal(command.options.quality, 80);
      assert.equal(command.options.fit, "cover");
      assert.equal(command.options.aspectRatioBarsColor, "#FF000080");
      assert.equal(command.options.concurrency, 4);
      assert.equal(command.options.tms, true);
      assert.equal(command.options.skipExisting, true);
      assert.equal(command.options.keepCanvas, true);
      assert.equal(command.options.retina, true);
      assert.equal(command.options.preview, true);
      assert.equal(command.options.metadata, true);
      assert.equal(command.options.dryRun, true);
    }
  });

  it("applies defaults for optional arguments", () => {
    const command = parseCliArgs(["--sourcePath", "map.png", "--targetPath", "out/"]);
    assert.equal(command.kind, "run");
    if (command.kind === "run") {
      assert.equal(command.options.tileSize, 256);
      assert.equal(command.options.minZoom, 0);
      assert.equal(command.options.maxZoom, undefined);
      assert.equal(command.options.format, "png");
      assert.equal(command.options.fit, "contain");
      assert.equal(command.options.tms, false);
      assert.equal(command.options.concurrency, 1);
      assert.equal(command.quiet, false);
    }
  });

  it("returns a help command", () => {
    assert.deepEqual(parseCliArgs(["--help"]), { kind: "help" });
    assert.deepEqual(parseCliArgs(["-h"]), { kind: "help" });
  });

  it("returns a version command", () => {
    assert.deepEqual(parseCliArgs(["--version"]), { kind: "version", version: packageJson.version });
  });

  it("throws when required arguments are missing", () => {
    assert.throws(() => parseCliArgs(["--targetPath", "out/"]), /Missing required option: "--sourcePath"/);
    assert.throws(() => parseCliArgs(["--sourcePath", "map.png"]), /Missing required option: "--targetPath"/);
  });

  it("throws on invalid option values", () => {
    const base = ["--sourcePath", "a", "--targetPath", "b"];
    assert.throws(() => parseCliArgs([...base, "--tileSize", "x"]), /Invalid tile size/);
    assert.throws(() => parseCliArgs([...base, "--format", "gif"]), /Invalid format/);
    assert.throws(() => parseCliArgs([...base, "--fit", "stretch"]), /Invalid fit/);
    assert.throws(() => parseCliArgs([...base, "--minZoom", "abc"]), /Invalid zoom/);
    assert.throws(() => parseCliArgs([...base, "--concurrency", "0"]), /Invalid concurrency/);
    assert.throws(() => parseCliArgs([...base, "--quality", "999"]), /Invalid quality/);
  });

  it("throws on unknown options", () => {
    assert.throws(() => parseCliArgs(["--sourcePath", "a", "--targetPath", "b", "--nope"]));
  });
});

describe("runCommand", () => {
  it("prints help and returns nothing", async () => {
    const io = createFakeImageIO({ width: 100, height: 50 });
    assert.deepEqual(await runCommand({ kind: "help" }, io), []);
  });

  it("prints the version and returns nothing", async () => {
    const io = createFakeImageIO({ width: 100, height: 50 });
    assert.deepEqual(await runCommand({ kind: "version", version: "1.0.0" }, io), []);
  });

  it("cuts a single source into the target directly", async () => {
    const io = createFakeImageIO({ width: 100, height: 50 });
    const command = parseCliArgs(["--sourcePath", "map.png", "--targetPath", "out"]);
    const results = await runCommand(command, io);
    assert.equal(results.length, 1);
    assert.equal(io.calls.ensureDirectory[0], "out");
  });

  it("splits multiple glob sources into per-source subdirectories", async () => {
    const dir = mkdtempSync(join(tmpdir(), "pmaptilescutter-cli-"));
    writeFileSync(join(dir, "a.png"), "");
    writeFileSync(join(dir, "b.png"), "");
    try {
      const io = createFakeImageIO({ width: 100, height: 50 });
      const command = parseCliArgs(["--sourcePath", join(dir, "*.png"), "--targetPath", "out"]);
      const results = await runCommand(command, io);

      assert.equal(results.length, 2);
      assert.ok(io.calls.ensureDirectory.includes(join("out", "a")));
      assert.ok(io.calls.ensureDirectory.includes(join("out", "b")));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("main", () => {
  it("returns 0 on success", async () => {
    const io = createFakeImageIO({ width: 100, height: 50 });
    assert.equal(await main(["--sourcePath", "map.png", "--targetPath", "out"], io), 0);
  });

  it("returns 0 in quiet mode", async () => {
    const io = createFakeImageIO({ width: 100, height: 50 });
    assert.equal(await main(["--sourcePath", "map.png", "--targetPath", "out", "--quiet"], io), 0);
  });

  it("returns 1 when the I/O backend throws an Error", async () => {
    const io = createThrowingImageIO(new Error("disk full"));
    assert.equal(await main(["--sourcePath", "map.png", "--targetPath", "out"], io), 1);
  });

  it("returns 1 when the I/O backend throws a non-Error", async () => {
    const io = createThrowingImageIO("something went wrong");
    assert.equal(await main(["--sourcePath", "map.png", "--targetPath", "out"], io), 1);
  });

  it("returns 1 when required arguments are missing", async () => {
    assert.equal(await main(["--targetPath", "out"]), 1);
  });

  it("returns 0 for --version", async () => {
    assert.equal(await main(["--version"]), 0);
  });

  it("returns 0 for --help", async () => {
    assert.equal(await main(["--help"]), 0);
  });

  it("uses a silent reporter in quiet mode without an injected io", async () => {
    const dir = mkdtempSync(join(tmpdir(), "pmaptilescutter-quiet-"));
    try {
      // A missing source exercises the silent-reporter branch before failing.
      assert.equal(await main(["--sourcePath", "missing.png", "--targetPath", join(dir, "out"), "--quiet"]), 1);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("USAGE", () => {
  it("documents the new options", () => {
    assert.match(USAGE, /--sourcePath/);
    assert.match(USAGE, /--targetPath/);
    assert.match(USAGE, /--format/);
    assert.match(USAGE, /--fit/);
    assert.match(USAGE, /--tms/);
    assert.match(USAGE, /--retina/);
    assert.match(USAGE, /--dryRun/);
  });
});
