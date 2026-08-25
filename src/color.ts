/**
 * Pure hex-color parsing. Replaces the `hex-rgb` dependency with a small,
 * fully-tested function that returns a plain `RgbaColor` (alpha `0..1`).
 */

import type { RgbaColor } from "./types.ts";

const HEX_PATTERN = /^#?([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

/** Expand shorthand like `abc` to `aabbcc` and `abc8` to `aabbcc88`. */
function expandShorthand(hex: string): string {
  let expanded = "";
  for (const character of hex) {
    expanded += character + character;
  }
  return expanded;
}

/**
 * Parse a hex color of the form `#RGB`, `#RGBA`, `#RRGGBB` or `#RRGGBBAA`
 * (leading `#` optional). Missing alpha defaults to fully opaque.
 */
export function parseHexColor(input: string): RgbaColor {
  const match = HEX_PATTERN.exec(input.trim());
  if (match === null) {
    throw new Error(`Invalid hex color "${input}". Expected #RGB, #RGBA, #RRGGBB or #RRGGBBAA.`);
  }

  let hex = match[1].toLowerCase();
  if (hex.length === 3 || hex.length === 4) {
    hex = expandShorthand(hex);
  }

  const red = Number.parseInt(hex.slice(0, 2), 16);
  const green = Number.parseInt(hex.slice(2, 4), 16);
  const blue = Number.parseInt(hex.slice(4, 6), 16);
  const alphaHex = hex.length === 8 ? hex.slice(6, 8) : "ff";
  const alpha = Number.parseInt(alphaHex, 16) / 255;

  return { red, green, blue, alpha };
}
