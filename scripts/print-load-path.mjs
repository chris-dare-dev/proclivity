// Prints the absolute path of the production build so it's obvious what to
// "Load unpacked" in chrome://extensions. Run indirectly via `npm run build:ext`.
//
// Why this exists: loading a *dev* build (`npm run dev`) produces a crxjs
// dev-mode extension that only works while Vite is running and is prone to
// being dropped by Chrome across restarts. A production build (`npm run build`)
// is standalone and carries the pinned manifest `key`, so it keeps the stable
// extension id. This script nudges toward the production folder every time.
import { resolve } from "node:path";

const dist = resolve(process.cwd(), "dist");

console.log(
  [
    "",
    "✔ Production build ready (standalone — no Vite server needed).",
    "",
    "  In chrome://extensions → Load unpacked, select:",
    `    ${dist}`,
    "",
    "  Tip: always load THIS folder from a production build, not `npm run dev`,",
    "  so Chrome keeps the stable extension id and the tab survives restarts.",
    "",
  ].join("\n"),
);
