import { defineManifest } from "@crxjs/vite-plugin";
import pkg from "./package.json" with { type: "json" };

/*
 * Manifest V3 manifest for Proclivity.
 *
 * `key` field stabilizes the extension ID across reinstalls so the OAuth
 * Client ID (registered in Google Cloud Console against that ID) keeps
 * working. The corresponding private key lives at .proclivity-key.pem
 * (gitignored). To re-derive the public key value below, see
 * plans/gemini-setup.md.
 *
 * `oauth2.client_id` is a placeholder until the developer registers a
 * Chrome-Extension-type OAuth client in GCP Console (steps in
 * plans/gemini-setup.md). The placeholder lets the build pass; the
 * Settings UI in gemini-m2 will display a "Connect Google account"
 * action that fails fast when the client_id is still the placeholder.
 */

const OAUTH_CLIENT_ID_PLACEHOLDER =
  "REPLACE_WITH_GCP_CLIENT_ID.apps.googleusercontent.com";

export default defineManifest({
  manifest_version: 3,
  name: "Proclivity",
  description: pkg.description,
  version: pkg.version,
  key: "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAvm5/r2D873e2MyKJk52x+aoM4wHy2v6MiEFWr4egFM2ncwOervuJr1MlRsg67CC25y8eqnQH2m1/HbkL7gtIxZaNqmjnkM4juqzKlm6+JdMW2EQDHHtVlNoPuvWzw4a/w0u70cjUNu/UsXmJt8HEo/pG6Bt5mLUXmkm5sTvBLTPnxSPiEQlf9iF5UR9/G1sjSfs6GzNqmUJeP57t2b3LA4+5ocpixQpoTrNikHXeGXEV4gJjA/oZw6zbpXh7frP5aiceKWdxgQMLO65dAb0jdJ2UKmcfbHrMORT096MokTvxeqqknLNXTijcuN47dqGXtXkd1qH9yg0BD9L7+QDFnwIDAQAB",
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
  host_permissions: ["https://generativelanguage.googleapis.com/*"],
  oauth2: {
    client_id: OAUTH_CLIENT_ID_PLACEHOLDER,
    scopes: ["https://www.googleapis.com/auth/generative-language.retriever"],
  },
});
