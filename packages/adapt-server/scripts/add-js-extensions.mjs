// Post-build pass that makes the tsup output Node-ESM-spec-compliant.
//
// tsup leaves relative imports/exports without `.js` extensions, e.g.
//     import { x } from "./y"
//     export * from "./y"
//     import("./y")
// Node's strict ESM resolver (and any other spec-compliant runtime) refuses
// these. Next.js's bundler tolerates them, but we ship to a wider audience
// than just Next, and "tested in raw Node" is also our smoke-test gate.
//
// Bare specifiers (e.g. `next/headers`, `react`) are intentionally left
// untouched. Those are the consumer's package-resolver problem; rewriting
// them would over-couple us to one resolver's quirks.

import { readdir, readFile, writeFile } from "node:fs/promises";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dist = resolve(__dirname, "..", "dist");

// Match the literal path inside a relative import/export/dynamic-import.
// Examples it matches: `./x`, `../foo/bar`, `./x.css` (leaves as-is below).
const RELATIVE_PATH = /(?<=(?:from|import)\s*\(?\s*['"])(\.\.?\/[^'"]+?)(?=['"])/g;

// Skip rewrite if the specifier already has an extension we recognise.
const SKIP_EXT = /\.(?:m?js|d\.ts|d\.mts|json|css|svg|png|jpe?g|gif|webp|woff2?|ttf|wasm)$/i;

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const out = [];
  for (const e of entries) {
    const p = join(dir, e.name);
    if (e.isDirectory()) {
      out.push(...(await walk(p)));
    } else if (/\.(?:js|d\.ts)$/.test(e.name)) {
      out.push(p);
    }
  }
  return out;
}

let touched = 0;
for (const file of await walk(dist)) {
  const src = await readFile(file, "utf-8");
  const out = src.replace(RELATIVE_PATH, (spec) =>
    SKIP_EXT.test(spec) ? spec : `${spec}.js`
  );
  if (src !== out) {
    await writeFile(file, out);
    touched++;
  }
}
console.log(`[add-js-extensions] rewrote ${touched} file(s) under ${dist}`);
