import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  parseConcurrency,
  parseFit,
  parseFormat,
  parseQuality,
  parseTileSize,
  parseZoom,
} from "../src/validation.ts";

describe("parseTileSize", () => {
  it("parses a positive integer", () => {
    assert.equal(parseTileSize("256"), 256);
    assert.equal(parseTileSize("0256"), 256);
  });

  it("throws on invalid input", () => {
    assert.throws(() => parseTileSize("abc"), /Invalid tile size/);
    assert.throws(() => parseTileSize(""), /Invalid tile size/);
    assert.throws(() => parseTileSize("256.5"), /Invalid tile size/);
    assert.throws(() => parseTileSize("-5"), /Invalid tile size/);
    assert.throws(() => parseTileSize("0"), /Invalid tile size/);
  });
});

describe("parseFormat", () => {
  it("accepts png, jpeg and webp", () => {
    assert.equal(parseFormat("png"), "png");
    assert.equal(parseFormat("jpeg"), "jpeg");
    assert.equal(parseFormat("webp"), "webp");
  });

  it("throws on anything else", () => {
    assert.throws(() => parseFormat("gif"), /Invalid format/);
    assert.throws(() => parseFormat(""), /Invalid format/);
  });
});

describe("parseFit", () => {
  it("accepts contain, cover and fill", () => {
    assert.equal(parseFit("contain"), "contain");
    assert.equal(parseFit("cover"), "cover");
    assert.equal(parseFit("fill"), "fill");
  });

  it("throws on anything else", () => {
    assert.throws(() => parseFit("stretch"), /Invalid fit/);
  });
});

describe("parseZoom", () => {
  it("parses a non-negative integer", () => {
    assert.equal(parseZoom("0"), 0);
    assert.equal(parseZoom("4"), 4);
  });

  it("throws on invalid input", () => {
    assert.throws(() => parseZoom("-1"), /Invalid zoom/);
    assert.throws(() => parseZoom("1.5"), /Invalid zoom/);
    assert.throws(() => parseZoom("x"), /Invalid zoom/);
  });
});

describe("parseConcurrency", () => {
  it("parses a positive integer", () => {
    assert.equal(parseConcurrency("1"), 1);
    assert.equal(parseConcurrency("8"), 8);
  });

  it("throws on invalid input", () => {
    assert.throws(() => parseConcurrency("0"), /Invalid concurrency/);
    assert.throws(() => parseConcurrency("x"), /Invalid concurrency/);
  });
});

describe("parseQuality", () => {
  it("parses a value in the 0..100 range", () => {
    assert.equal(parseQuality("0"), 0);
    assert.equal(parseQuality("80"), 80);
    assert.equal(parseQuality("100"), 100);
  });

  it("throws on out-of-range and invalid values", () => {
    assert.throws(() => parseQuality("-1"), /Invalid quality/);
    assert.throws(() => parseQuality("101"), /Invalid quality/);
    assert.throws(() => parseQuality("x"), /Invalid quality/);
  });
});
