#!/usr/bin/env node
/**
 * bloomwright-ui invariant guard (SPEC.md §5 / NFR1).
 *
 * bloomwright-ui is the render core. It MAY depend on rendering libraries
 * (echarts, hast-util-*, unist-util-visit, postcss) and on `astro`, but it must
 * NOT:
 *   1. import a host-application path alias (`@data/*`, `@utils/*`, …) — app
 *      behavior enters only through injected seams (render pipeline, cache
 *      store), never a hardcoded import;
 *   2. import `bloomwright-mdx` — the dependency direction is app → mdx → ui, so
 *      a ui→mdx import would create a cycle; or
 *   3. read the ambient environment (`process.env` / `loadEnv`) — every input is
 *      a factory/option argument (options-first, SPEC §4.6), so the caller's
 *      injected render pipeline owns any credentials.
 *
 * Only real module specifiers are inspected for (1)/(2). For (3), comments are
 * stripped first so documentation that merely mentions a token is not flagged.
 */
import { readdir, readFile } from "node:fs/promises";
import { join, extname } from "node:path";

const ROOT = new URL("../src/", import.meta.url).pathname;

/** A module specifier is forbidden if it matches any of these. */
const FORBIDDEN_SPECIFIERS = [
  /^@data\//,
  /^@utils\//,
  /^@content\//,
  /^@integrations\//,
  /^@appTypes\//,
  /^@components\//,
  /^@layouts\//,
  /^@runtime\//,
  /^bloomwright-mdx(\/|$)/,
];

/** Ambient-env tokens forbidden anywhere in (comment-stripped) source. */
const FORBIDDEN_ENV = [
  { rx: /\bprocess\.env\b/, label: "ambient env read (pass config as options)" },
  { rx: /\bloadEnv\s*\(/, label: "ambient env load (the consumer resolves env, not us)" },
];

const EXT = new Set([".ts", ".tsx", ".astro", ".mjs"]);

/** Matches every form that introduces a runtime/type module dependency. */
const SPECIFIER_PATTERNS = [
  /\b(?:import|export)\b[^;'"]*?\bfrom\s*['"]([^'"]+)['"]/g, // import/export … from "X"
  /\bimport\s*['"]([^'"]+)['"]/g, //                            import "X"
  /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g, //                  import("X")
  /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g, //                 require("X")
];

/** Blank out comments while preserving newlines so line numbers stay accurate. */
function stripComments(text) {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
    .replace(/\/\/[^\n]*/g, "");
}

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else if (EXT.has(extname(entry.name))) yield full;
  }
}

const lineOf = (text, index) => text.slice(0, index).split("\n").length;

let violations = 0;
for await (const file of walk(ROOT)) {
  const raw = await readFile(file, "utf8");

  // (1)/(2) — forbidden module specifiers.
  for (const pattern of SPECIFIER_PATTERNS) {
    for (const match of raw.matchAll(pattern)) {
      const specifier = match[1];
      if (FORBIDDEN_SPECIFIERS.some((rx) => rx.test(specifier))) {
        console.error(
          `✗ ${file}:${lineOf(raw, match.index)}  forbidden import → "${specifier}"`,
        );
        violations++;
      }
    }
  }

  // (3) — ambient env reads (comment-stripped).
  stripComments(raw)
    .split("\n")
    .forEach((line, i) => {
      for (const { rx, label } of FORBIDDEN_ENV) {
        if (rx.test(line)) {
          console.error(`✗ ${file}:${i + 1}  ${label} → ${line.trim()}`);
          violations++;
        }
      }
    });
}

if (violations > 0) {
  console.error(`\nbloomwright-ui invariant broken: ${violations} violation(s).`);
  process.exit(1);
}
console.log(
  "✓ Invariant holds — no host/bloomwright-mdx imports, no ambient env reads.",
);
