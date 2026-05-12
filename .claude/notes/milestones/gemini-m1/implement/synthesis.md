# Implement synthesis — gemini-m1

## Built

- **`manifest.config.ts` `key` field** — Base64-encoded DER public key (388 chars) committed verbatim at `manifest.config.ts:25`. Stabilizes the extension ID at `cpflcminmnekdfjpmdhgblbolmclcdkk` across reinstalls. (AC #1)
- **`.gitignore` private-key exclusion** — `*.pem` rule added at `.gitignore:10`. `git check-ignore` confirms `.proclivity-key.pem` is matched. (AC #2)
- **Extension ID derived from key** — verified offline via the openssl pipeline documented in `plans/gemini-setup.md` §1: `openssl rsa -in .proclivity-key.pem -pubout -outform DER | openssl dgst -sha256 -binary | xxd -p -c 32 | head -c 32 | tr '0-9a-f' 'a-p'` produces `cpflcminmnekdfjpmdhgblbolmclcdkk`. Visual verification against `chrome://extensions` is part of the developer's external-write step (load unpacked). (AC #3 — agent half)
- **`identity` permission + `oauth2` block** — `manifest.config.ts:42` adds `"identity"` to permissions; `manifest.config.ts:44-47` declares `oauth2: { client_id, scopes }` with the `generative-language.retriever` scope. `client_id` is a placeholder constant (`REPLACE_WITH_GCP_CLIENT_ID.apps.googleusercontent.com`) — comment at `manifest.config.ts:18-21` explains the lifecycle. (AC #4)
- **`host_permissions`** — `manifest.config.ts:43` declares `["https://generativelanguage.googleapis.com/*"]`. (AC #5)
- **`plans/gemini-setup.md`** — 5-section developer walkthrough (prereqs, key generation, GCP project + API enable + consent screen, Client ID creation, extension ID verification, rotation, scope-coverage open question). 153 lines, links to `plans/gemini-integration-research.md` for theory. (AC #6)
- **`npm run build`** — clean. `dist/manifest.json` grew 0.54 → 1.23 kB (delta +0.69 kB). All JS bundles unchanged. Total bundle delta under 1 kB. (AC #7)

## Files touched

- `manifest.config.ts` — added `key`, `host_permissions`, `oauth2`, `"identity"` permission, header comment, placeholder constant.
- `.gitignore` — added `*.pem` rule with a comment.
- `plans/gemini-setup.md` — new file, full developer walkthrough.
- `.proclivity-key.pem` — generated; NOT tracked (gitignored).

## Deferred

- The real `oauth2.client_id` value. Lives in `external_writes_required` — the user registers the OAuth Client ID in GCP Console and pastes it into `manifest.config.ts` (per `plans/gemini-setup.md` §3).
- The `cloud-platform` scope fallback. Per the open question carried from research synthesis: if `gemini-spike-1` returns 403 on a `generateContent` call, the scopes array must be expanded to include `cloud-platform`. Not a build-time concern; surfaces in spike/m2.
- All gemini.ts code. m1 deliberately ships only the manifest delta + setup doc; the auth wrappers and Settings UI are `gemini-m2`.

## external_writes_required

```yaml
external_writes_required:
  - "User must create or select a Google Cloud project in Google Cloud Console (console.cloud.google.com)"
  - "User must enable the Generative Language API in the Google Cloud project"
  - "User must configure the OAuth Consent Screen with user type External and add themselves as a Test User"
  - "User must create an OAuth 2.0 Client ID of type Chrome Extension with the stable extension ID in the Item ID field"
  - "User must run openssl key-generation locally and store the private key at .proclivity-key.pem"
  - "User must load the extension unpacked and verify chrome://extensions ID matches the derived ID"
  - "User must paste the issued OAuth Client ID into manifest.config.ts oauth2.client_id"
```

(Unchanged from research synthesis; implementation did not introduce new external writes.)

## Test deltas

None. No test files in the project. Per `CLAUDE.md`, the verification bar is `npm run build`, which ran clean. Per the proclivity-specific milestone-pipeline note, doc-only commits are exempt from the test-delta requirement; the production-code delta in m1 is the manifest config, which has no test surface (it's input to the build, not a runtime module).
