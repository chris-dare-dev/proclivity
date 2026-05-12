# gemini-m1 External Research Brief

**Milestone:** `gemini-m1` — Stable extension ID + OAuth Client registration  
**Authored:** 2026-05-11  
**Researcher role:** external-research + external-writes  

---

## 1. External Sources Consulted

| # | URL | sha256 of fetched content | Takeaway |
|---|-----|--------------------------|---------|
| 1 | https://developer.chrome.com/docs/extensions/reference/manifest/key | `f92efb47ae7407913ec67c51e2459a81f54bf9de94318f646d11726c6af6bae1` | Chrome does not publicly document the exact ID-derivation algorithm in its manifest `key` reference; the page only confirms that matching the `key` field guarantees a consistent ID. The algorithm is described only in community and chromium-source references. |
| 2 | https://developer.chrome.com/docs/extensions/how-to/integrate/oauth | `56279d473020a1b0fe9f772454e9939f2ac75e1ba2908b810eeb9f4decff8f23` | Official GCP console flow for Chrome Extension OAuth client: navigate to Clients page → Create Client → application type "Chrome Extension" → enter extension ID in "Item ID" field. `identity` permission required in manifest. No mention of Internal vs External consent screen in this guide. |
| 3 | https://developer.chrome.com/docs/extensions/mv3/tut_oauth/ | `bb30a51b8623f8b1c5baf8bf57ecd644635443221db57b9a63fc2e346618b21f` | Full oauth2 tutorial for MV3 extensions. Confirms `oauth2 { client_id, scopes[] }` as the complete manifest block schema. Confirms `identity` permission is required. Confirms redirect-URI-free flow via Chrome's identity system. |
| 4 | https://ai.google.dev/gemini-api/docs/oauth | `37635d867427a98203d9c8ff6950d1f29ff2574578d6ba3222c2d5cad0f114a3` | Gemini API OAuth guide specifies two scopes in its gcloud command: `cloud-platform` AND `generative-language.retriever`. Does not state which scope covers `generateContent` specifically. Consent screen user type must be **External** (Internal requires Google Workspace). Recommends adding self as a Test User while in Testing status. |
| 5 | https://developer.chrome.com/docs/extensions/reference/manifest/oauth2 | `4ac0b1c9857bec2e1a621125e4db781da318c9deca7f80e6ab60053886b2f184` | Manifest `oauth2` block requires `client_id` (string) and `scopes` (array of URL strings). No trailing slash noted. Page last updated 2022 — implementation details may have evolved. |
| 6 | https://developer.chrome.com/docs/extensions/reference/api/identity | `f04b544ff2931562c7173f5ef0dba1ed46cf07e121bff2480ecdeaf5b03a00c2` | `getAuthToken` API is current, no deprecation notices. `TokenDetails` accepts `interactive`, `account`, `enableGranularPermissions`, `scopes`. Requires `identity` manifest permission. Token has ~1 hour expiry; Chrome refreshes transparently. |
| 7 | `node_modules/@crxjs/vite-plugin/dist/index.d.ts` (v2.4.0, local) | `6712fc13562457e1b30b19b8e1983ee0802ad7be7dcf0181873d273dd681085a` | **Confirmed:** `ManifestV3` interface in `@crxjs/vite-plugin@2.4.0` explicitly types `key?: string \| undefined`, `oauth2?: { client_id: string; scopes?: string[] \| undefined } \| undefined`, and `host_permissions?: string[] \| undefined`. All three fields are first-class typed fields — no TypeScript cast or `as any` needed. |

### Key findings per research question

**Extension ID derivation algorithm.** The official Chrome docs do not publish the exact algorithm in prose. The algorithm is documented only in Chromium source references and community posts (notably the Clerk guide and related tooling). Based on the existing research in `plans/gemini-integration-research.md §1.3`, the algorithm is: `SHA-256(DER-encoded public key bytes) → first 32 hex chars → translate 0-9a-f → a-p`. The openssl commands in that doc produce the correct ID and are the implementation-ready procedure. No contradictory evidence was found in official docs; the chrome.com key-reference page simply does not discuss the algorithm at all.

**GCP Console flow for Chrome Extension OAuth Client ID.** Confirmed across two official sources (sources 2 and 3): the flow is Clients page → Create Client → application type "Chrome Extension" → Item ID field for the extension ID. No client secret is issued for Chrome Extension type. The consent screen **must be External** (source 4) for a personal Google account (Internal requires Google Workspace). While in Testing status, only test users added in Cloud Console can consent; this is the correct posture for a personal unpacked extension.

**Scope string `generative-language.retriever` vs `cloud-platform`.** The Gemini API OAuth guide (source 4) shows both scopes together in its gcloud example. The Python code example in the same doc uses only `generative-language.retriever` for semantic retrieval. Neither the OAuth guide nor the generateContent REST reference explicitly states which scope is required for `generateContent` calls — the API's discovery document (`$discovery/rest?version=v1beta`) shows no explicit scope listed for the `generateContent` method at all. **Risk conclusion:** `generative-language.retriever` may be insufficient for `generateContent`; `cloud-platform` is the safe fallback. The existing research doc §3.2 recommends starting with `generative-language.retriever` and adding `cloud-platform` on auth error — this remains the correct conservative approach but introduces a runtime verification step.

**Manifest V3 `oauth2` block schema.** Confirmed (sources 3, 5, 7): required fields are `client_id` (string) and `scopes` (string array). The `scopes` field is typed as optional in the crxjs type (`scopes?: string[] | undefined`) but the Chrome runtime requires it for `getAuthToken` to resolve scopes from the manifest. No trailing slash in scope URLs. Common gotcha: omitting `scopes` does not fail at build time but causes `getAuthToken` to fail at runtime.

**`@crxjs/vite-plugin@2.4.0` `defineManifest` TypeScript types.** Verified directly from the installed package's `dist/index.d.ts`. All three fields (`key`, `oauth2`, `host_permissions`) are explicitly declared in the `ManifestV3` interface. No `as any`, no index signature abuse needed. The `defineManifest` function accepts `ManifestV3Options<T>` which is `ManifestOptions<T>` (= `Omit<ManifestV3, keyof FilePathFields<string>> & FilePathFields<T>`). **Note:** the installed version is `2.4.0`, not `2.0.0-beta.28` as stated in `brief-1.md §2.2` — the `package.json` declares `^2.0.0-beta.28` but npm resolved to `2.4.0`. The type definitions are for this resolved version.

---

## 2. external_writes_required

```yaml
external_writes_required:
  - "User must create or select a Google Cloud project in Google Cloud Console (console.cloud.google.com)"
  - "User must enable the Generative Language API in the Google Cloud project (APIs & Services → Library → search 'Generative Language API' → Enable)"
  - "User must configure the OAuth Consent Screen with user type External, fill in App name and support email, and add themselves as a Test User (APIs & Services → OAuth consent screen)"
  - "User must create an OAuth 2.0 Client ID of type 'Chrome Extension' with the stable extension ID in the Item ID field, and record the issued Client ID string (APIs & Services → Credentials → Create Credentials → OAuth client ID)"
  - "User must run the openssl key-generation commands locally to produce the RSA key pair, store the private key outside the repo (e.g., ~/.config/proclivity/proclivity-ext.pem), and extract the Base64 public key for the manifest"
  - "User must load the extension unpacked from dist/ in chrome://extensions and visually verify that the displayed extension ID matches the ID derived from the public key via the openssl sha256 command"
  - "User must manually paste the issued OAuth Client ID into manifest.config.ts oauth2.client_id before the oauth2 block is functional (the agent can add a placeholder; the real value comes from the GCP Console step above)"
```

---

## 3. Riskiest assumption + alternative

**Riskiest assumption: `generative-language.retriever` is sufficient for `generateContent` calls.**

The milestone's acceptance criteria instructs the implementer to declare `https://www.googleapis.com/auth/generative-language.retriever` as the sole scope in the `oauth2.scopes` array. The scope name is specific to "semantic retrieval" functionality and was originally defined for the Gemini API's grounded-retrieval feature — not for the general `generateContent` endpoint. Neither the official `$discovery/rest?version=v1beta` document nor the `ai.google.dev/gemini-api/docs/oauth` page explicitly lists which OAuth scope gates `generateContent`. When this assumption fails, `chrome.identity.getAuthToken` will succeed (Chrome accepts the narrow scope) and return a token, but the subsequent `POST …/models/gemini-2.5-flash:generateContent` will return HTTP 403 Forbidden, which may be misread as a quota error. This risk is not catchable at build time, only at `gemini-spike-1` runtime. The existing research doc §3.2 notes this uncertainty and recommends adding `cloud-platform` on auth error — the implementer must treat that as a first-class instruction rather than a footnote.

**Alternative: declare both scopes from day one.**

Rather than optimistically requesting only `generative-language.retriever`, the manifest could declare both `https://www.googleapis.com/auth/generative-language.retriever` and `https://www.googleapis.com/auth/cloud-platform` from the start. The UX cost is a slightly broader consent dialog (users see two scopes instead of one), but both scopes are Google-owned and the consent dialog wording is nearly identical. The `cloud-platform` scope is confirmed to cover the Generative Language API. An alternative path that avoids OAuth entirely: use `launchWebAuthFlow` with PKCE instead of `getAuthToken`, which decouples the extension from a registered Client ID and does not require the stable-ID trick — but at the cost of implementing PKCE, token storage, and refresh logic, which the roadmap explicitly chose to avoid (research doc §2.1). The two-scope approach is the lowest-risk incremental fix and should be the backup if `gemini-spike-1` returns a 403.

---

## 4. Acceptance criteria the implementer must meet

1. `manifest.config.ts` includes a top-level `key` field containing the Base64-encoded DER public key; the field is typed via `ManifestV3.key?: string | undefined` (no cast needed in `@crxjs/vite-plugin@2.4.0`).

2. `.gitignore` excludes `*.pem` (or the specific filename `.proclivity-key.pem`); the private key file must not be traceable in `git log` or `git diff` at any point.

3. The 32-character extension ID derived offline via `openssl rsa ... | sha256sum | head -c32 | tr 0-9a-f a-p` matches the ID shown in `chrome://extensions` after loading the built `dist/` directory unpacked — verified manually before the milestone is closed.

4. `manifest.config.ts` declares `"identity"` in the `permissions` array and an `oauth2` block with `client_id` (real or documented placeholder) and `scopes: ["https://www.googleapis.com/auth/generative-language.retriever"]`; if `gemini-spike-1` returns HTTP 403 on `generateContent`, the scope list must be expanded to also include `"https://www.googleapis.com/auth/cloud-platform"` before the milestone closes.

5. `manifest.config.ts` declares `host_permissions: ["https://generativelanguage.googleapis.com/*"]`; this is required for MV3 `fetch()` from extension pages (new-tab) to the Gemini API endpoint.

6. A new `plans/gemini-setup.md` document walks the complete GCP-console flow — project selection, Generative Language API enablement, External consent screen configuration, Test User addition, Chrome Extension OAuth Client ID creation with the Item ID field — plus the openssl key-pair generation commands and the ID verification procedure; the document must be usable by the developer on a new machine without reference to this brief.

7. `npm run build` (`tsc -b && vite build`) passes with zero TypeScript errors and the total bundle size delta is less than 1 kB (manifest fields are JSON strings; no new JS is added).
