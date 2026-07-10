import { defineManifest } from "@crxjs/vite-plugin";
import pkg from "./package.json" with { type: "json" };

// Google Photos Picker API OAuth client_id — see README "Google Photos setup".
// It lives in the manifest rather than chrome.storage because
// `chrome.identity.getAuthToken` reads its OAuth client config exclusively
// from manifest.json at install time.
//
// This is a Chrome-Extension-type client, so Google binds it to exactly one
// Item ID: `cpflcminmnekdfjpmdhgblbolmclcdkk`, the ID that `key` below pins.
// The two values are a matched pair — changing either one alone makes
// getAuthToken fail with `bad client id: <client_id>`.
//
// The previous client (…-fuont6t2if38p47u59ers1uj65trl08d) is bound to a
// path-derived ID from a checkout that predates `key`. It stays valid for any
// machine still on the old manifest, and can be deleted once every install has
// rebuilt against this one.
const GOOGLE_OAUTH_CLIENT_ID =
  "455929700165-g5ofdseaujmlmob280kod830ird2lsro.apps.googleusercontent.com";

// Base64 DER public key pinning the extension ID to
// `cpflcminmnekdfjpmdhgblbolmclcdkk`. Chrome takes the first 16 bytes of the
// key's SHA-256 and maps hex 0-9a-f → a-p to derive that ID.
//
// This field is load-bearing for OAuth and must not be removed. Without it,
// Chrome derives an unpacked extension's ID from the absolute path of the
// loaded directory, so the ID changes whenever the checkout moves. The
// client_id above is registered in Google Cloud Console against exactly one
// Item ID, and `chrome.identity.getAuthToken` fails with
// `bad client id: <client_id>` the moment the two diverge.
//
// It was dropped as collateral damage by 9547cd6 (a revert of the Gemini
// Cloud-API manifest delta, which had introduced `key`, `identity` and
// `oauth2` as one block). `identity` and `oauth2` were later restored for
// Google Photos; `key` was not — leaving the ID bound to the dist path.
//
// Rotating this key changes the extension ID, which re-namespaces
// chrome.storage.local (orphaning todos, reminders and settings) and requires
// re-registering the Item ID in Cloud Console. See README "Google Photos
// setup" and plans/gemini-setup.md §1.
const EXTENSION_PUBLIC_KEY =
  "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAvm5/r2D873e2MyKJk52x+aoM4wHy2v6MiEFWr4egFM2ncwOervuJr1MlRsg67CC25y8eqnQH2m1/HbkL7gtIxZaNqmjnkM4juqzKlm6+JdMW2EQDHHtVlNoPuvWzw4a/w0u70cjUNu/UsXmJt8HEo/pG6Bt5mLUXmkm5sTvBLTPnxSPiEQlf9iF5UR9/G1sjSfs6GzNqmUJeP57t2b3LA4+5ocpixQpoTrNikHXeGXEV4gJjA/oZw6zbpXh7frP5aiceKWdxgQMLO65dAb0jdJ2UKmcfbHrMORT096MokTvxeqqknLNXTijcuN47dqGXtXkd1qH9yg0BD9L7+QDFnwIDAQAB";

export default defineManifest({
  manifest_version: 3,
  name: "Proclivity",
  description: pkg.description,
  version: pkg.version,
  key: EXTENSION_PUBLIC_KEY,
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
