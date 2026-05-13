#!/usr/bin/env node
// Bundle-size budget check.
//
// The newtab page (chrome_url_overrides.newtab in manifest.config.ts) emits an
// HTML shell that synchronously loads:
//   - one <script type="module" src="..."> entry
//   - zero or more <link rel="modulepreload" href="...">
//   - one or more <link rel="stylesheet" href="...">
//
// Everything else (the three.js mesh background, modals, section bundles) is
// lazy-imported via React.lazy and does not count toward the initial load.
//
// CLAUDE.md sets the budget at ~200 kB for the initial JS chunk. We enforce
// a hard ceiling of 220 kB to leave a small amount of headroom for HMR/dev
// artifacts that occasionally leak into the entry; over 200 kB we emit a
// non-failing warning so growth is visible immediately.

import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const DIST = "dist";
const HTML = join(DIST, "src/newtab/index.html");

const WARN_AT_KB = 200;
const FAIL_AT_KB = 220;

const html = readFileSync(HTML, "utf8");

function extractAll(pattern) {
  return [...html.matchAll(pattern)].map((m) => m[1]);
}

const scriptSrcs = extractAll(/<script[^>]+src="([^"]+)"/g);
const modulePreloads = extractAll(
  /<link[^>]+rel="modulepreload"[^>]+href="([^"]+)"/g
);
const stylesheets = extractAll(
  /<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"/g
);

function resolve(ref) {
  // crxjs emits absolute-from-extension-root paths (start with "/").
  return ref.startsWith("/") ? join(DIST, ref.slice(1)) : join(DIST, ref);
}

function sizeOf(ref) {
  const p = resolve(ref);
  try {
    return statSync(p).size;
  } catch {
    console.error(`MISSING referenced asset: ${ref} (resolved ${p})`);
    process.exit(1);
  }
}

const jsAssets = [
  ...scriptSrcs.map((s) => ({ kind: "entry", ref: s })),
  ...modulePreloads.map((s) => ({ kind: "preload", ref: s })),
];
const cssAssets = stylesheets.map((s) => ({ kind: "css", ref: s }));

let jsBytes = 0;
console.log("newtab initial JS:");
for (const a of jsAssets) {
  const b = sizeOf(a.ref);
  jsBytes += b;
  console.log(`  [${a.kind.padEnd(7)}] ${(b / 1024).toFixed(1).padStart(7)} kB  ${a.ref}`);
}

let cssBytes = 0;
console.log("newtab initial CSS:");
for (const a of cssAssets) {
  const b = sizeOf(a.ref);
  cssBytes += b;
  console.log(`  [${a.kind.padEnd(7)}] ${(b / 1024).toFixed(1).padStart(7)} kB  ${a.ref}`);
}

const jsKb = jsBytes / 1024;
const cssKb = cssBytes / 1024;
console.log(
  `\nTotals: JS ${jsKb.toFixed(1)} kB · CSS ${cssKb.toFixed(1)} kB ` +
    `· budget: warn>${WARN_AT_KB} kB, fail>${FAIL_AT_KB} kB`
);

if (jsKb > FAIL_AT_KB) {
  console.error(
    `\nFAIL: newtab initial JS is ${jsKb.toFixed(1)} kB, exceeding the ` +
      `${FAIL_AT_KB} kB hard ceiling by ${(jsKb - FAIL_AT_KB).toFixed(1)} kB. ` +
      `Either lazy-load the new code via React.lazy + Suspense, or justify ` +
      `raising the ceiling in CLAUDE.md.`
  );
  process.exit(1);
}

if (jsKb > WARN_AT_KB) {
  console.log(
    `\n::warning::newtab initial JS is ${jsKb.toFixed(1)} kB, over the ` +
      `documented ${WARN_AT_KB} kB budget but under the ${FAIL_AT_KB} kB hard ` +
      `ceiling. Trim or lazy-load before this grows further.`
  );
}

console.log("OK: bundle-size budget check passed.");
