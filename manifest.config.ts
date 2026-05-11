import { defineManifest } from "@crxjs/vite-plugin";
import pkg from "./package.json" with { type: "json" };

export default defineManifest({
  manifest_version: 3,
  name: "Proclivity",
  description: pkg.description,
  version: pkg.version,
  icons: {
    "16": "public/icon-16.png",
    "48": "public/icon-48.png",
    "128": "public/icon-128.png",
  },
  chrome_url_overrides: {
    newtab: "src/newtab/index.html",
  },
  background: {
    service_worker: "src/background/service-worker.ts",
    type: "module",
  },
  permissions: ["storage", "alarms", "notifications"],
});
