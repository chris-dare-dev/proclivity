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
  // Toolbar action: no popup — the icon exists to carry the pending-alert
  // badge count (set by the SW; immune to OS notification suppression) and
  // clicking it opens a new tab, i.e. the dashboard. The "notifications"
  // permission was removed with the move to in-app alerts: OS-level
  // notification delivery fails silently on macOS (Sequoia regressions,
  // Notification Center suppression) and Windows (Focus Assist).
  action: {
    default_title: "Proclivity",
  },
  permissions: ["storage", "alarms", "identity"],
  // host_permissions:
  //   - photospicker.googleapis.com — Picker session lifecycle (create, poll,
  //     list mediaItems, delete).
  //   - *.googleusercontent.com — the CDN that serves the actual picked-photo
  //     bytes (mediaFile.baseUrl resolves here). Without this, fetch() for the
  //     image bytes is blocked by Chrome with a bare "Failed to fetch".
  //   - http://127.0.0.1/* — Obsidian Local REST API (Phase G roadmap ingest /
  //     write-back). Match patterns carry NO port, so this single entry covers
  //     :27123 (the non-encrypted HTTP server). It grants the service worker a
  //     real CORS bypass for the authenticated GET/POST the plugin doesn't
  //     otherwise permit from a chrome-extension:// origin. (If HTTPS :27124 is
  //     ever adopted, add "https://127.0.0.1/*".)
  host_permissions: [
    "https://photospicker.googleapis.com/*",
    "https://*.googleusercontent.com/*",
    "http://127.0.0.1/*",
  ],
  oauth2: {
    client_id: GOOGLE_OAUTH_CLIENT_ID,
    scopes: [
      "https://www.googleapis.com/auth/photospicker.mediaitems.readonly",
    ],
  },
});
