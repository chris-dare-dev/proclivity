# gemini-m1 Research Brief

**Milestone:** `gemini-m1` — Stable extension ID + OAuth Client registration  
**Created:** 2026-05-11  
**Scope:** Read-only context research — no implementation in this phase.

---

## 1. Affected Files

| Path | Role | Status |
|------|------|--------|
| `manifest.config.ts` | Add `key` field (Base64 public key), `identity` permission, `oauth2` block, `host_permissions` | Modify |
| `.gitignore` | Ensure `*.pem` patterns to exclude private key | Modify |
| `plans/gemini-setup.md` | **NEW** — walk GCP console flow for OAuth Client ID registration | Create |
| `vite.config.ts` | No changes required; does not need to load env vars for the public key | Reference only |
| `src/types/index.ts` | May extend `UserSettings` with `gemini` sub-shape in **gemini-m2**; not in gemini-m1 | Reference only |
| `tsconfig.json` | Verify strict flags remain active; no changes required | Reference only |

---

## 2. Existing Patterns to Follow

### 2.1 Manifest Configuration

**Current manifest structure** (`manifest.config.ts:1–23`):
- Uses `@crxjs/vite-plugin`'s `defineManifest()` function (line 1).
- Returns an object literal with `manifest_version`, `name`, `description`, `icons`, `chrome_url_overrides`, `background`, `permissions`.
- `permissions` array currently declares `["storage", "alarms", "notifications"]` (line 21).
- Does NOT use the callback form; it is a static object literal.

**Pattern to follow:**
- Add the `key` field with the Base64-encoded public key directly in the manifest object (it will become a top-level field in the generated `manifest.json`).
- Extend the `permissions` array to include `"identity"` (for `chrome.identity.getAuthToken`).
- Add a new `oauth2` object with `client_id` and `scopes` array (per research doc §1.1 and §2.2).
- Add a new `host_permissions` array with `"https://generativelanguage.googleapis.com/*"` (for MV3 fetch access per research §7.5).

**Research doc citations:**
- Key field mechanism: `plans/gemini-integration-research.md:49–55` (extension ID derivation from public key).
- Manifest delta example: `plans/gemini-integration-research.md:79–100` (complete manifest structure).
- Permission requirements: `plans/gemini-integration-research.md:127–138` (identity permission + oauth2 block).
- Host permissions for Gemini fetch: `plans/gemini-integration-research.md:95–98` (generativelanguage.googleapis.com host permission).

### 2.2 Build and Emission

**How `defineManifest` works:**
- `@crxjs/vite-plugin` v2.0.0-beta.28 (per `package.json`, line 26) intercepts the `manifest` object.
- On `npm run build`, it reads the object, expands any icon paths, and writes `dist/manifest.json`.
- The `key` field and `oauth2`/`host_permissions` blocks pass through unchanged as long as they are valid JSON-serializable objects.
- No special callback form is needed for static fields; the static object form works fine.

**Research doc citation:**
- @crxjs behavior with arbitrary fields: `plans/gemini-integration-research.md:102–111` (note on `defineManifest` callback form as an optional pattern, not required).

### 2.3 Plans Document Formatting

**Existing roadmap docs** in the repo use:
- Headings hierarchy (H1, H2, H3) for structure.
- Code fences (triple backtick) for command examples and code snippets.
- Inline citations in the form `§X.Y` for cross-references within the document.
- Prose with clear subsections for different concerns (GCP flow, extension setup, etc.).

**Pattern to follow for `plans/gemini-setup.md`:**
- H1 title: "Proclivity OAuth Client ID Setup (GCP Side)"
- Sections covering: (a) one-time per-developer setup (generate key pair), (b) registering Client ID in GCP Console, (c) testing the OAuth flow, (d) troubleshooting.
- Step-by-step numbered instructions with expected UI states.
- Screenshots/references as needed (or prose descriptions if screenshots are not available).
- Clear note that this is a developer-only setup doc (not end-user facing).

**Research doc citation:**
- GCP console flow: `plans/gemini-integration-research.md:24–37` (OAuth Client ID creation steps).
- Extension ID verification: `plans/gemini-integration-research.md:59–72` (openssl commands to derive stable ID and verify it matches).

### 2.4 Commit Message Style

**From recent commits** (per `git log --oneline`):
- Conventional commits format: `<type>(<scope>): <subject>` — subject ≤ 50 chars after prefix.
- Common scopes used: `build`, `docs`, `feat`, `fix`, `refactor`, `style`, `tune`.
- For this work, appropriate scopes are `build` (manifest changes), `docs` (new setup doc), or combined as needed.
- Co-author trailer required per `CLAUDE.md:54–55`: `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>`

**Example commit messages (inferred from codebase style):**
- `build(manifest): add key + oauth2 + identity permission for gemini integration`
- `docs(gemini): add GCP OAuth client setup guide at plans/gemini-setup.md`

**Reference:**
- `CLAUDE.md:46–57` (commit conventions, scopes, co-author trailer).

### 2.5 TypeScript Strictness

**Enforce at build time** per `CLAUDE.md:63–68` and `tsconfig.json:14–16`:
- `strict: true` — all strict checks enabled.
- `exactOptionalPropertyTypes: true` — `foo?: T` and `foo?: T | undefined` are distinct.
- `noUncheckedIndexedAccess: true` — array index access returns `T | undefined`.

**Impact on manifest config:**
- The manifest object is a plain TypeScript literal; no new types are being defined.
- No impact on the strict flags — the manifest is already free of optional/undefined concerns.

---

## 3. Existing Tests

**Test coverage in the repo:**
- **No test files exist.** A grep for `*.test.ts`, `*.test.tsx`, `*.spec.ts`, `*.spec.tsx` returns nothing.
- The project relies on `npm run build` (TypeScript + Vite) as the primary verification gate (`CLAUDE.md:59–68`).
- Manual smoke-test workflows are documented in `README.md:234–244` (load unpacked, open new tab, verify UI).

**Implication for gemini-m1:**
- No unit or integration tests to update.
- Verification is by:
  1. `npm run build` passes with no TS errors.
  2. Manual load-unpacked test verifying the derived extension ID matches `chrome://extensions`.
  3. Acceptance criteria in the milestone definition (per roadmap).

---

## 4. Footguns from CLAUDE.md

### 4.1 Branching Policy (§ "Branching — work on `main` only")

**CRITICAL:** All work is direct-to-main.
- No feature branches.
- No worktrees used for canonical work (worktrees are sandboxes only; real work merges to `main`).
- Commits land on `main` immediately and are pushed to `origin/main` after verification (`CLAUDE.md:6–44`).
- Push to `origin/main` is expected after meaningful work; no "confirmation pause" needed (`CLAUDE.md:37–42`).
- `git push --force` to `main` requires explicit user authorization (`CLAUDE.md:44`).

### 4.2 Strict TypeScript Flags Are Non-Negotiable

**Per `CLAUDE.md:67–68` and `README.md:341–356`:**
- `strict`, `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess` must stay enabled.
- Do NOT disable these flags to "make code pass."
- `npm run build` must pass cleanly — this runs `tsc -b && vite build` (per README.md:337).

### 4.3 Pre-Commit Hooks Must Not Be Skipped

**Per `CLAUDE.md:56`:**
- Never use `--no-verify` on commits.
- Pre-commit hooks are part of the verification pipeline; they must pass.

### 4.4 Bundle Size Discipline

**Per `CLAUDE.md:71–72` and `README.md:342–344`:**
- Initial newtab chunk should stay under ~200 kB.
- Heavy dependencies (three.js, etc.) are lazy-loaded via `React.lazy` + `Suspense`.
- `vite.config.ts:26` warns on chunk size > 1000 kB (intentionally high to accommodate three.js).
- For gemini-m1 (manifest + setup doc only), no new npm dependencies — bundle delta is < 1 kB.

### 4.5 No Disabling React Strict Mode

**Per `CLAUDE.md:94–95`:**
- Do not disable React strict mode to "make tests pass."
- The extension already runs in strict mode (no code disables it).

---

## 5. Open Questions for the Implementer

1. **Private key storage location:** The research doc suggests `~/.config/proclivity/` (outside the repo) per `plans/gemini-integration-research.md:75`. Should the implementer create that directory during setup, or assume it is pre-created? Should `plans/gemini-setup.md` include step 0 for directory creation?

2. **Base64 public key derivation:** The research doc shows the openssl command chain in `plans/gemini-integration-research.md:65–72`. Should `plans/gemini-setup.md` provide a single consolidated script (bash function or copy-paste-able command) that developers can run once, or step-by-step openssl invocations? Recommend copy-paste-able one-liner for UX.

3. **Environment variable vs. hardcoded public key:** The research doc mentions two patterns — commit the Base64 string directly to `manifest.config.ts`, or load from `process.env.CRX_PUBLIC_KEY` via the callback form (`plans/gemini-integration-research.md:102–111`). Which approach should gemini-m1 use? **Recommend:** commit the Base64 string directly (it is not a secret), to keep build setup simple and avoid .env files.

4. **OAuth Client ID placeholder in manifest:** In gemini-m1, the `oauth2.client_id` field must be populated. Should it be a placeholder string (e.g., `"YOUR_CLIENT_ID.apps.googleusercontent.com"`) with a comment, or left as an empty string? **Recommend:** placeholder with a comment, so the manifest is valid JSON but the missing Client ID is obvious.

5. **Verification of extension ID match:** The acceptance criteria requires "re-deriving the extension ID from the public key yields the same string as `chrome://extensions` shows." Should `plans/gemini-setup.md` include step-by-step instructions for loading unpacked and visually verifying the ID, or assume the developer is familiar with `chrome://extensions`? **Recommend:** include both the openssl command to derive the ID locally and instructions for visual verification.

---

## 6. Summary

**gemini-m1** is a manifest + documentation milestone with zero code changes to the LLM module. The work includes:

1. **Manifest delta:** Add `key`, `identity` permission, `oauth2` block, and `host_permissions` to `manifest.config.ts`. Follow existing literal-object pattern in the file.
2. **New setup doc:** Create `plans/gemini-setup.md` walking the GCP console flow, key generation, and Client ID registration. Cite research doc extensively.
3. **Gitignore update:** Ensure `*.pem` is excluded (verify and add if missing).
4. **Verification:** `npm run build` passes; manual load-unpacked confirms ID match.

**No test files to update.** No new npm dependencies. **Bundle delta < 1 kB.** Hard dependency: `gemini-spike-1` must report green (OAuth token retrieval validates token-generation flow).

