# Security

## 1. Scope and threat model

Proclivity is a personal Chrome extension loaded unpacked on a single machine. It is not published to the Chrome Web Store and has no server component, telemetry, or analytics. There is no Proclivity account, cross-device sync, or shared-account model. Network access is limited to explicit user-enabled integrations (Google Photos, read-only Google Calendar, Obsidian Local REST) and the user-opened Monarch embed.

**Adversaries considered:**

- Malicious or compromised npm dependencies that run during `npm install` or bundle into the extension output.
- Malicious websites the user visits that attempt to interact with the extension's storage or service worker via the browser's extension APIs.
- Agent-authored code changes that introduce unsafe patterns (remote fetches, storage-schema corruption, overly broad permissions) without explicit intent.

**Out of scope:**

- Physical access to an unlocked machine.
- OS-level compromise (keyloggers, memory inspection, disk imaging).
- Social engineering of the developer/user.

---

## 2. Permissions

Declared in [`manifest.config.ts`](manifest.config.ts):

| Permission | Why |
|---|---|
| `storage` | Persist todos, sprints, Gantt tasks, and reminders in `chrome.storage.local`. |
| `alarms` | Schedule reminder firings without keeping the extension page open. |
| `identity` | Ask Chrome for scope-specific Google OAuth tokens after an explicit Connect action. Tokens are never persisted by Proclivity. |
| `declarativeNetRequestWithHostAccess` | Strip framing headers only for the user-configured Monarch sub-frame. Rules cannot affect unrelated sites. |

The `notifications` permission was removed (2026-07): reminders now surface as in-app alert toasts on the dashboard plus a toolbar-badge count, because OS-level notification delivery fails silently on both macOS and Windows. The manifest declares a toolbar `action` (no popup) solely to carry that badge.

Host permissions are restricted to the Photos Picker/CDN, local Obsidian API,
and Monarch domains listed in the manifest. There is no `<all_urls>`, `tabs`,
or content-script access. Google Calendar's API supports the extension origin
through normal CORS, so Calendar adds no host permission.

`chrome_url_overrides: { newtab: "src/newtab/index.html" }` replaces only the new-tab page. It does not grant access to any existing tab, does not inject into browsing tabs, and cannot read or write any page's DOM.

**Policy:** every permission added in the future must be documented in this section and justified in the commit message before it ships. No permission should be added "just in case".

---

## 3. Data handling

State is separated by responsibility under keys defined in [`src/storage/constants.ts`](src/storage/constants.ts):

| Key | Purpose | Cap |
|---|---|---|
| `proclivity:state:v1` | App data (todos, sprints, Gantt, reminders, tags, settings) | bounded by feature volume; ≪ 10 MB in practice |
| `proclivity:logs:v1` | Observability ring buffer — appended on `warn` / `error` always, on `info` when the user has the debug toggle on | hard-capped at **500 entries** (~100 kB), oldest dropped on overflow |
| `proclivity:photos:v1` | User-picked, downscaled Google Photos bytes | bounded by the Photos cache budget |
| `proclivity:google-calendar:v1` | Enable flag plus a small history of minimal 42-day read-only event snapshots | at most 6 windows and 5,000 normalized events total; normally far below 1 MB |
| `proclivity:roadmap:v1` | Obsidian connection configuration and write-back cursor | small configuration record |
| `proclivity:alerts:v1` | Pending in-app reminder alerts | bounded by active reminder volume |

**What is stored in the state key:** todo items (title, notes, scope, completion state, tags), sprint metadata, Gantt charts and tasks, reminders (title, fire time, recurrence, optional linked-todo ID, tags), tags, and user settings. OAuth tokens are never stored. The user-entered Obsidian API key is isolated in the roadmap key and excluded from JSON export.

**What is stored in the log key:** structured `LogEntry` records with `{ ts, level, ns, msg, ctx? }`. The `ctx` field can carry contextual values from instrumentation call sites — e.g. tool-call parse failures include up to 500 chars of the raw model output. Tag labels and prompts may therefore end up in the buffer; the cap above bounds growth. The log key is **not** included in the app's import / export flows and is not cleared by the "Clear all data" action; it has its own clear affordance in the (forthcoming) in-app log viewer.

**PII boundary:** local titles, notes, tags, and chat prompts remain local unless an explicitly configured feature says otherwise. Calendar stores only the fetched event ID/title/time/link needed by the grid; it does not request descriptions, attendees, organizer emails, locations, or conferencing data. Google Calendar records remain outside the main exportable state.

**Documented network boundary:** outbound calls are limited to the source modules for Photos Picker/media, Google OAuth revocation, Google Calendar `events.list`, and the Obsidian proxy. Calendar receives only a bearer token plus a two-day-padded visible date range (clipped back to the exact grid locally); no local Proclivity item is an input to that request. Monarch is loaded only when its iframe destination is opened.

**Storage cap:** `chrome.storage.local` is capped at approximately 10 MB across all keys for the extension. The user-picked Photos cache dominates usage and has its own byte budget. Calendar retains at most six minimal 42-day snapshots, replaces matching windows wholesale, and enforces a 5,000-event total ceiling. Any new unbounded collection needs explicit pruning before merging.

**Storage write safety:** [`src/storage/storage.ts`](src/storage/storage.ts) serializes all writes through a promise chain (`writeChain`) to prevent concurrent-update races from the newtab side. [`src/background/service-worker.ts`](src/background/service-worker.ts) maintains a separate `swWriteChain` for the same reason. The ring buffer in [`src/observability/ring-buffer.ts`](src/observability/ring-buffer.ts) maintains its own per-context chain for the same reason; cross-context interleaving (SW + newtab writing the log key simultaneously) is tolerated — at worst one entry is silently dropped, which is acceptable for a debug log. These two chains are independent — if the SW and the UI both write within the same tick, the last write wins for that key. This is acceptable for the current feature set but must be revisited if multi-tab editing or background-sync is added.

---

## 4. Service-worker attack surface

The service worker ([`src/background/service-worker.ts`](src/background/service-worker.ts)) is the only background execution context. It registers these listeners:

- `chrome.runtime.onInstalled` — calls `reconcileAlarms()` to align `chrome.alarms` with stored reminders.
- `chrome.runtime.onStartup` — same as above.
- `chrome.alarms.onAlarm` — reads the matching reminder from storage, enqueues an in-app pending alert (rendered as a toast by the dashboard; count mirrored to the toolbar badge), then advances or marks the reminder fired.
- `chrome.storage.onChanged` — diffs the old and new reminders arrays and creates/clears `chrome.alarms` entries accordingly.

**What the SW does NOT do:**

- It does not register `chrome.runtime.onConnectExternal`; websites cannot post messages to it. Internal messages are validated and limited to the sanctioned Photos/Obsidian proxy operations.
- It does not synchronize Google Calendar in the background. Calendar reads happen only from the extension page after opt-in.
- It does not execute `eval` or dynamically constructed code.

**Attacker-controlled input:** the only channel through which an external actor could influence SW behavior is `chrome.storage.local`. Websites cannot write to an extension's `chrome.storage.local` directly — that API is scoped to the extension origin. A compromised dependency bundled into the newtab page could write to storage, which the SW would then act on.

**Alert injection:** `reminder.title` is stored in the pending-alert queue and rendered by the dashboard through React/sonner, which escape rendered strings as plain text — no HTML or markdown is interpreted. A crafted title containing markup characters appears verbatim in the toast; no injection vector exists here under the current feature set. If alerts are ever extended to construct URLs from user-typed content, those values must be validated before use.

---

## 5. Dependency policy

**Production runtime dependencies** (what ships in the extension bundle):

| Package | Version pin | Reason |
|---|---|---|
| `react` | `^18.3.1` | UI framework |
| `react-dom` | `^18.3.1` | DOM renderer |
| `three` | `^0.169.0` | WebGL mesh background |
| `@react-three/fiber` | `^8.18.0` | React bindings for Three.js; pinned to v8 because v9 requires React 19 |

Adding any package to `dependencies` requires a justification in the commit message. The initial newtab chunk must remain under ~200 kB; heavier code (Three.js) must stay lazy-loaded via `React.lazy` + `Suspense`.

**Build-time only:** `@crxjs/vite-plugin`, `@vitejs/plugin-react`, `vite`, `typescript`, and the `@types/*` packages are dev dependencies. They are not bundled into the extension.

**Audit status (as of 2026-05-11):** `npm audit` reports zero vulnerabilities.

Two findings previously reported (`esbuild <=0.24.2` dev-server CORS; `rollup <2.80.0` path traversal) were resolved by upgrading to Vite 7 (ships esbuild `^0.25`), `@crxjs/vite-plugin@2.4.0` (stable), and adding a scoped `overrides` block in `package.json` that pins the rollup transitive under `@crxjs/vite-plugin` to `^2.80.0`. Both findings only affected build tooling — they never reached the shipped extension bundle — but resolving them keeps `npm audit` clean as a true signal.

Do not run `npm audit fix --force` blindly — it would still try to downgrade `@crxjs/vite-plugin` to `1.x`, which is incompatible with `manifest.config.ts`. Investigate any new finding individually first.

**Additional rules:**

- Never commit `node_modules`. It is already in `.gitignore`.
- Scrutinize `postinstall` scripts in any new dependency before accepting them.
- GLSL shaders are inline string literals in [`src/components/MeshBackground.tsx`](src/components/MeshBackground.tsx). They are compiled at bundle time by the GPU driver; they are not loaded from the network or from disk at runtime. There is no runtime shader-injection vector.

---

## 6. Build and CSP

MV3 enforces a strict default Content Security Policy that disallows `eval`, `new Function()`, inline event handlers, and remote script sources. The build pipeline (Vite + `@vitejs/plugin-react`) does not generate any of these patterns.

Three.js and `@react-three/fiber` operate entirely via WebGL APIs and do not require `eval` or `wasm-unsafe-eval`. They are compatible with MV3 CSP without modification.

`chunkSizeWarningLimit: 1000` in [`vite.config.ts`](vite.config.ts) suppresses the Vite chunk-size warning for the deferred Three.js chunk. This is a DX-only setting; it has no effect on CSP or runtime security.

Do not add `unsafe-eval`, `wasm-unsafe-eval`, or any remote script source to the extension's CSP.

---

## 7. What an agent must not do

The following rules apply to any agent (or human) making code changes. They extend the constraints in [`CLAUDE.md`](CLAUDE.md) with security-specific rationale.

- **Never disable strict mode.** Do not remove `strict: true`, `exactOptionalPropertyTypes`, or `noUncheckedIndexedAccess` from `tsconfig.json`. Do not disable React strict mode. These catch real bugs; "it passes with strict off" is not a fix.
- **Never add `host_permissions: "<all_urls>"`** or any broad host pattern. The extension has no legitimate need to access arbitrary websites.
- **Never add `unsafe-eval` or `wasm-unsafe-eval` to the CSP.** If a library requires either, it is not suitable for this extension.
- **Never introduce an undocumented remote-network call.** Any new integration must be explicitly authorized, use the narrowest host/scope, minimize transmitted data, and update this file.
- **Never add content scripts or the `tabs` permission** without explicit authorization from the user. Content scripts dramatically expand the attack surface; they can read and modify every page the user visits.
- **Never use `dangerouslySetInnerHTML` on user-typed content.** React escapes rendered strings by default — do not bypass that. If rich rendering of user input is ever needed, sanitize with a vetted library first.
- **Never commit secrets.** There are no API keys, tokens, or credentials in this project. Keep it that way. If a future feature requires an API key, store it only in `chrome.storage.local` (user-entered) and never hardcode it in source.
- **Never skip pre-commit hooks** (`--no-verify`). If a hook fails, fix the underlying issue.
- **Preserve the write-queue pattern** in both `storage.ts` and `service-worker.ts`. Do not replace `update()` with direct `set()` calls in contexts where concurrent writes are possible.

---

## 8. Reporting

This is a personal, unpublished extension. There is no bug bounty, no CVE process, and no formal disclosure pipeline.

If you find a genuine security issue, open an issue in the repository at `git@github.com:chris-dare-dev/proclivity.git` or contact the author directly. Because the extension is local-only and single-user, the practical blast radius of any vulnerability is limited to one person's data on one machine.

---

## 9. Audit checklist

Run through the following on each significant change before committing:

- Every `fetch`/`XMLHttpRequest` hit is an intentional, documented integration with bounded inputs and validated outputs.
- `manifest.config.ts` permissions are unchanged, or any new permission is justified in this file and in the commit message.
- Host permissions remain narrowly enumerated; `<all_urls>` is forbidden.
- No `dangerouslySetInnerHTML` has been introduced on any user-controlled content.
- `npm audit` output has been reviewed. New high/critical findings must be acknowledged before merging.
- Any user input that flows into a URL, shell-like context, or DOM insertion point (other than normal React rendering) is validated or escaped at the point of use.
- The `STORAGE_KEY` constant (`proclivity:state:v1`) is unchanged, or a migration path for existing stored data has been implemented and tested.
- The write-queue chains in `storage.ts` and `service-worker.ts` have not been removed or bypassed.
