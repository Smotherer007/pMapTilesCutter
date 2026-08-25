import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { parseHexColor } from "../src/color.ts";

describe("parseHexColor", () => {
  it("parses a 6-digit hex with opaque alpha", () => {
    assert.deepEqual(parseHexColor("#ff0000"), { red: 255, green: 0, blue: 0, alpha: 1 });
  });

  it("parses an 8-digit hex with alpha", () => {
    assert.deepEqual(parseHexColor("#000000FF"), { red: 0, green: 0, blue: 0, alpha: 1 });
    assert.deepEqual(parseHexColor("#00000000"), { red: 0, green: 0, blue: 0, alpha: 0 });
  });

  it("scales alpha into the 0..1 range", () => {
    const { alpha } = parseHexColor("#00000080");
    assert.ok(Math.abs(alpha - 128 / 255) < 1e-9);
  });

  it("parses 3- and 4-digit shorthand", () => {
    assert.deepEqual(parseHexColor("#f00"), { red: 255, green: 0, blue: 0, alpha: 1 });
    assert.deepEqual(parseHexColor("#f00f"), { red: 255, green: 0, blue: 0, alpha: 1 });
  });

  it("accepts uppercase, lowercase and a missing leading #", () => {
    assert.deepEqual(parseHexColor("FF0000"), { red: 255, green: 0, blue: 0, alpha: 1 });
    assert.deepEqual(parseHexColor("#Ff0000"), { red: 255, green: 0, blue: 0, alpha: 1 });
  });

  it("ignores surrounding whitespace", () => {
    assert.deepEqual(parseHexColor("  #ff0000  "), { red: 255, green: 0, blue: 0, alpha: 1 });
  });

  it("throws on invalid input", () => {
    assert.throws(() => parseHexColor("red"), /Invalid hex color/);
    assert.throws(() => parseHexColor("#12"), /Invalid hex color/);
    assert.throws(() => parseHexColor("#12345"), /Invalid hex color/);
    assert.throws(() => parseHexColor("#gggggg"), /Invalid hex color/);
  });
});
