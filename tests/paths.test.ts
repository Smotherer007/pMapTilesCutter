import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";

import { canvasFilePath, outputDirName, tileDirectory, tileExtension, tileFilePath } from "../src/paths.ts";

describe("tileExtension", () => {
  it("maps formats to file extensions", () => {
    assert.equal(tileExtension("png"), "png");
    assert.equal(tileExtension("jpeg"), "jpg");
    assert.equal(tileExtension("webp"), "webp");
  });
});

describe("canvasFilePath", () => {
  it("names the canvas file after the zoom level", () => {
    assert.equal(canvasFilePath("out", 0), join("out", "canvas_0.png"));
    assert.equal(canvasFilePath("out", 3), join("out", "canvas_3.png"));
  });
});

describe("tileDirectory", () => {
  it("builds zoom/x directory paths", () => {
    assert.equal(tileDirectory("out", 1, 2), join("out", "1", "2"));
  });
});

describe("tileFilePath", () => {
  it("names a tile after its y coordinate and format", () => {
    assert.equal(tileFilePath(join("out", "1", "2"), 5, "png", false), join("out", "1", "2", "5.png"));
    assert.equal(tileFilePath(join("out", "1", "2"), 5, "jpeg", false), join("out", "1", "2", "5.jpg"));
  });

  it("adds the @2x suffix for retina tiles", () => {
    assert.equal(tileFilePath(join("out", "1", "2"), 5, "png", true), join("out", "1", "2", "5@2x.png"));
  });
});

describe("outputDirName", () => {
  it("strips the directory and extension", () => {
    assert.equal(outputDirName("/a/b/map.png"), "map");
    assert.equal(outputDirName("photo.webp"), "photo");
  });

  it("strips only the last extension", () => {
    assert.equal(outputDirName("archive.tar.gz"), "archive.tar");
  });

  it("keeps names without an extension", () => {
    assert.equal(outputDirName("/a/b/noext"), "noext");
  });
});
