# gemini-m1 — research synthesis

Produced from `brief-1.md` (codebase context) and `brief-2.md` (external + writes). Both briefs validate against `brief.schema.json` and both reported `injection_attempts: 0`.

## Affected files

- `manifest.config.ts` — add `key` (Base64 DER public key), extend `permissions` with `"identity"`, add `oauth2` block, add `host_permissions`. Uses `@crxjs/vite-plugin@2.4.0`'s `ManifestV3` type which natively declares all three fields (no `as any` needed). [brief-2 §1.7]
- `.gitignore` — add `*.pem` exclusion so the RSA private key cannot be committed.
- `plans/gemini-setup.md` (NEW) — developer-only setup doc walking key generation, GCP Console flow, and verification.
- `vite.config.ts`, `src/types/index.ts`, `tsconfig.json` — reference only; no changes in m1.

No test files exist in the project today; the verification bar is `npm run build` + manual `chrome://extensions` ID match.

## Acceptance criteria (deduped, ≤7)

1. `manifest.config.ts` includes a top-level `key` field with the Base64-encoded DER public key.
2. `.gitignore` excludes `*.pem`; the private key never enters git history.
3. The extension ID derived offline from the public key (`openssl rsa … | sha256 | head -c32 | tr 0-9a-f a-p`) matches the ID Chrome displays in `chrome://extensions` after loading the built `dist/` unpacked.
4. `manifest.config.ts` declares `"identity"` in `permissions` and an `oauth2` block with `client_id` (placeholder allowed) and `scopes`.
5. `manifest.config.ts` declares `host_permissions: ["https://generativelanguage.googleapis.com/*"]`.
6. A new `plans/gemini-setup.md` walks the developer through key generation, GCP project + consent screen + OAuth Client ID registration, and ID verification — usable on a fresh machine without back-reference to the briefs.
7. `npm run build` passes; total bundle delta < 1 kB.

## external_writes_required

```yaml
external_writes_required:
  - "User must create or select a Google Cloud project in Google Cloud Console (console.cloud.google.com)"
  - "User must enable the Generative Language API in the Google Cloud project (APIs & Services → Library → search 'Generative Language API' → Enable)"
  - "User must configure the OAuth Consent Screen with user type External, fill in App name and support email, and add themselves as a Test User (APIs & Services → OAuth consent screen)"
  - "User must create an OAuth 2.0 Client ID of type 'Chrome Extension' with the stable extension ID in the Item ID field, and record the issued Client ID string (APIs & Services → Credentials → Create Credentials → OAuth client ID)"
  - "User must run the openssl key-generation commands locally to produce the RSA key pair, store the private key at .proclivity-key.pem, and extract the Base64 public key for the manifest"
  - "User must load the extension unpacked from dist/ in chrome://extensions and visually verify that the displayed extension ID matches the ID derived from the public key"
  - "User must manually paste the issued OAuth Client ID into manifest.config.ts oauth2.client_id before the oauth2 block is functional (the agent can add a placeholder; the real value comes from the GCP Console step above)"
```

## Open questions

1. **Scope strategy** ([brief-2 §3]): the milestone AC specifies only `generative-language.retriever`, but brief-2's external research finds that scope's coverage of `generateContent` is *undocumented* — `cloud-platform` is the safe fallback. Brief-2 recommends declaring both scopes from day 1; the roadmap AC says only one. **Implementer decision**: ship only `generative-language.retriever` per the roadmap's intent, but in `gemini-spike-1` if a 403 surfaces on a `generateContent` call, expand the scope list before closing `gemini-m1`.
2. **Private key path**: roadmap and AC say `.proclivity-key.pem` at repo root (gitignored). Brief-1 floated `~/.config/proclivity/` as a research-doc suggestion but the AC is canonical — use the repo-root path.
3. **OAuth Client ID placeholder**: brief-1's recommendation — a literal placeholder string like `"REPLACE_WITH_GCP_CLIENT_ID.apps.googleusercontent.com"` with an inline comment pointing to `plans/gemini-setup.md`. Avoids env-var indirection for a single-developer project.
4. **Setup-doc detail**: include both the openssl one-liner (copy-paste) and the visual `chrome://extensions` verification step. Brief-1's recommendation; consistent with the roadmap's "usable on a fresh machine" criterion.
