import { defineManifest } from "@crxjs/vite-plugin";
import pkg from "./package.json" with { type: "json" };

// Google Photos Picker API OAuth client_id. Filled in by the user during
// first-time setup — see README "Google Photos setup". The value below is a
// placeholder; the Photos feature is inert until a real client_id is
// substituted here (and the extension reloaded). We keep it in the manifest
// (rather than chrome.storage) because `chrome.identity.getAuthToken` reads
// its OAuth client config exclusively from manifest.json at install time.
const GOOGLE_OAUTH_CLIENT_ID =
  "455929700165-fuont6t2if38p47u59ers1uj65trl08d.apps.googleusercontent.com";

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
  permissions: ["storage", "alarms", "notifications", "identity"],
  // host_permissions:
  //   - photospicker.googleapis.com — Picker session lifecycle (create, poll,
  //     list mediaItems, delete).
  //   - *.googleusercontent.com — the CDN that serves the actual picked-photo
  //     bytes (mediaFile.baseUrl resolves here). Without this, fetch() for the
  //     image bytes is blocked by Chrome with a bare "Failed to fetch".
  host_permissions: [
    "https://photospicker.googleapis.com/*",
    "https://*.googleusercontent.com/*",
  ],
  oauth2: {
    client_id: GOOGLE_OAUTH_CLIENT_ID,
    scopes: [
      "https://www.googleapis.com/auth/photospicker.mediaitems.readonly",
    ],
  },
});
