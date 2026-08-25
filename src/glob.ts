/**
 * Source-path expansion for batch runs. Supports a single file, a directory of
 * images, and glob patterns with `*` (within a path segment) and `**` (across
 * segments). No external dependencies.
 */

import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp", ".tif", ".tiff", ".gif", ".avif"]);

/** True when the path contains a glob wildcard. */
export function hasGlobMagic(pattern: string): boolean {
  return pattern.includes("*");
}

/** Compile a glob pattern (supports `*` and `**`) into a RegExp. */
export function globToRegExp(pattern: string): RegExp {
  let body = "";
  let i = 0;
  while (i < pattern.length) {
    const char = pattern[i];
    if (char === "*") {
      if (pattern[i + 1] === "*") {
        // `**/` matches zero or more leading directory segments.
        if (pattern[i + 2] === "/") {
          body += "(?:.*/)?";
          i += 3;
        } else {
          body += ".*";
          i += 2;
        }
      } else {
        body += "[^/]*";
        i += 1;
      }
    } else if (/[.+^${}()|[\]\\]/.test(char)) {
      body += `\\${char}`;
      i += 1;
    } else {
      body += char;
      i += 1;
    }
  }
  return new RegExp(`^${body}$`);
}

/** Directory that contains the first glob segment (the search root). */
export function globBaseDirectory(pattern: string): string {
  const magicIndex = pattern.indexOf("*");
  if (magicIndex === -1) {
    return ".";
  }
  const prefix = pattern.slice(0, magicIndex).replace(/[\\/]+$/, "");
  return prefix === "" ? "." : prefix;
}

/** Recursively list all files under `dir` (as paths relative to the dir). */
function listFilesRecursive(dir: string): string[] {
  const out: string[] = [];
  const stack = [dir];
  while (stack.length > 0) {
    const current = stack.pop()!;
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const full = join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(full);
      } else if (entry.isFile()) {
        out.push(full);
      }
    }
  }
  return out;
}

/** List image files directly inside `dir` (non-recursive). */
function listImageFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && IMAGE_EXTENSIONS.has(extnameOf(entry.name)))
    .map((entry) => join(dir, entry.name));
}

function extnameOf(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot === -1 ? "" : name.slice(dot).toLowerCase();
}

function isDirectory(path: string): boolean {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

/** Expand a source path into a list of concrete file paths. */
export function expandSourcePaths(sourcePath: string): string[] {
  if (hasGlobMagic(sourcePath)) {
    const baseDir = globBaseDirectory(sourcePath);
    const regex = globToRegExp(sourcePath);
    return listFilesRecursive(baseDir).filter((file) => regex.test(file)).sort();
  }
  if (isDirectory(sourcePath)) {
    return listImageFiles(sourcePath).sort();
  }
  return [sourcePath];
}
