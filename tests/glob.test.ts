import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { expandSourcePaths, globBaseDirectory, globToRegExp, hasGlobMagic } from "../src/glob.ts";

describe("hasGlobMagic", () => {
  it("detects wildcards", () => {
    assert.equal(hasGlobMagic("a.png"), false);
    assert.equal(hasGlobMagic("*.png"), true);
    assert.equal(hasGlobMagic("a/**/b.png"), true);
  });
});

describe("globToRegExp", () => {
  it("matches a single-segment wildcard", () => {
    const re = globToRegExp("*.png");
    assert.equal(re.test("a.png"), true);
    assert.equal(re.test("sub/a.png"), false);
    assert.equal(re.test("a.jpg"), false);
  });

  it("matches a recursive wildcard", () => {
    const re = globToRegExp("**/*.png");
    assert.equal(re.test("a.png"), true);
    assert.equal(re.test("sub/a.png"), true);
    assert.equal(re.test("a.jpg"), false);
  });

  it("matches an anchored directory prefix", () => {
    const re = globToRegExp("maps/*.png");
    assert.equal(re.test("maps/a.png"), true);
    assert.equal(re.test("other/a.png"), false);
  });

  it("escapes regex special characters", () => {
    const re = globToRegExp("a.b.png");
    assert.equal(re.test("a.b.png"), true);
    assert.equal(re.test("axb.png"), false);
  });
});

describe("globBaseDirectory", () => {
  it("returns the directory before the first wildcard", () => {
    assert.equal(globBaseDirectory("maps/*.png"), "maps");
    assert.equal(globBaseDirectory("*.png"), ".");
    assert.equal(globBaseDirectory("**/*.png"), ".");
  });

  it("returns '.' for a pattern without a wildcard", () => {
    assert.equal(globBaseDirectory("a.png"), ".");
  });
});

describe("expandSourcePaths", () => {
  let dir: string;

  before(() => {
    dir = mkdtempSync(join(tmpdir(), "pmaptilescutter-glob-"));
    writeFileSync(join(dir, "a.png"), "");
    writeFileSync(join(dir, "b.png"), "");
    writeFileSync(join(dir, "note.txt"), "");
    writeFileSync(join(dir, "README"), "");
    mkdtempSync(join(dir, "sub-"));
  });

  after(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("returns a single file unchanged", () => {
    const single = join(dir, "a.png");
    assert.deepEqual(expandSourcePaths(single), [single]);
  });

  it("returns a missing path unchanged (treated as a single file)", () => {
    const missing = join(dir, "missing.png");
    assert.deepEqual(expandSourcePaths(missing), [missing]);
  });

  it("lists image files in a directory", () => {
    const result = expandSourcePaths(dir);
    assert.deepEqual(result, [join(dir, "a.png"), join(dir, "b.png")]);
  });

  it("expands a single-segment glob", () => {
    const result = expandSourcePaths(join(dir, "*.png"));
    assert.deepEqual(result, [join(dir, "a.png"), join(dir, "b.png")]);
  });

  it("expands a recursive glob", () => {
    const result = expandSourcePaths(join(dir, "**", "*.png"));
    assert.deepEqual(result, [join(dir, "a.png"), join(dir, "b.png")]);
  });
});
