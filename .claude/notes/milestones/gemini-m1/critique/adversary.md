# Critique — gemini-m1 — adversary

**Critic:** adversary
**Commit range:** cb800ac..1cdcd4f
**Generated:** 2026-05-12T01:50:00Z
**Diff stats:** 3 files changed, 209 insertions(+), 1 deletion(-)

## Verdict

SHIP-WITH-FIXES

The manifest delta is mechanically correct — the extension ID derivation (openssl pipeline) was independently verified and produces exactly `cpflcminmnekdfjpmdhgblbolmclcdkk`, matching the commit message's claim. All 7 acceptance criteria are met by the diff. One HIGH finding must be remediated before closing the milestone: `SECURITY.md` was not updated despite its own policy requiring it, leaving three factually false statements in a load-bearing security doc. Two MEDIUM findings (scope-skip instruction in the setup doc and a minor key-format inconsistency) are fixable in a follow-up commit without blocking the milestone if the team accepts the risk.

## Executive summary

- [HIGH] `SECURITY.md` §2 permissions table is stale (missing `identity`/`host_permissions`/`oauth2`), §2 contains a now-false explicit claim "No host_permissions are declared", and §9 audit checklist item 3 gives a stale "no host_permissions introduced" assertion — violating SECURITY.md's own §2 policy.
- [MEDIUM] `plans/gemini-setup.md` §2.3 instructs the developer to skip adding OAuth scopes to the GCP consent screen during setup; the research doc (§1.1) and Google's own docs require registering scopes there to avoid a blank or broken consent dialog when `chrome.identity.getAuthToken` is first called.
- [MEDIUM] `plans/gemini-setup.md` §1 key-generation command uses `openssl genrsa` (PKCS1 format) while the research doc §1.3 uses the more robust `openssl pkcs8 -topk8 -nocrypt` pipeline; the two commands produce equivalent public keys, but a developer following setup.md and then cross-checking the research doc will see inconsistent procedures.
- [PASS] Extension ID derivation independently verified: `echo -n "<key>" | base64 -d | openssl dgst -sha256 -binary | xxd -p -c 32 | head -c 32 | tr '0-9a-f' 'a-p'` → `cpflcminmnekdfjpmdhgblbolmclcdkk`. Matches commit-message claim exactly.
- [PASS] Commit is GPG-signed (status `G`), landed on `main`, subject is 43 chars after prefix (≤ 50), co-author trailer present.
- [PASS] No external writes executed — `state.json` correctly lists them as `external_writes_required`, all deferred to Phase 4. No boundary violation.
- [PASS] Scope strategy follows research synthesis open question #1: `generative-language.retriever` only, with `cloud-platform` fallback documented in setup.md. Correct.
- [PASS] No new npm dependencies; bundle delta is JS-zero (manifest JSON only). No bundle bloat.

## Findings

### CRITICAL

_None._

### HIGH

#### [HIGH] H1 — SECURITY.md not updated despite its own §2 update policy

- **File:** `SECURITY.md`
- **Line:** 24–35 (permissions table + "No host_permissions are declared" claim); also line 147 (audit checklist item 3)
- **Anchor:** `No \`host_permissions\` are declared. The extension canno`
- **What:** SECURITY.md §2 permissions table lists only `storage`, `alarms`, `notifications` and states "No `host_permissions` are declared. The extension cannot make credentialed cross-origin requests"; the diff adds `identity`, `host_permissions: ["https://generativelanguage.googleapis.com/*"]`, and an `oauth2` block, making these statements factually false. SECURITY.md §9 audit checklist item 3 ("No host_permissions have been introduced") is now a stale instruction that will give developers a false green on future audits. The SECURITY.md §2 policy reads: "every permission added in the future must be documented in this section and justified in the commit message before it ships" — the commit message justifies the permissions but the section itself was not updated.
- **Why it matters:** The security doc is the load-bearing reference for future code reviewers and the adversary SKILL; leaving three factually false statements here means the doc is no longer trustworthy as a checklist, and a developer following the §9 audit checklist will incorrectly conclude that host_permissions are absent.
- **Proposed fix:** Add `identity`, `host_permissions`, and the `oauth2` block to the SECURITY.md §2 permissions table with justifications. Remove or reword the explicit "No `host_permissions` are declared" sentence. Update §9 audit checklist item 3 from "No host_permissions have been introduced" to "host_permissions are limited to the declared set in manifest.config.ts". Also update SECURITY.md §7's "This extension is local-only by design" note to acknowledge the planned Gemini integration and the fact that outbound network calls will ship in gemini-m2/m3.
- **Regression-guard:** Add a CI-level `grep` assertion in a future `pre-commit` hook: `grep -c "identity" SECURITY.md` must be ≥ 1 after this fix lands; or simply mandate the adversary SKILL check SECURITY.md permissions table matches `manifest.config.ts` permissions on each milestone.
- **Source critic:** adversary
- **Source axis:** 4. Doc drift

### MEDIUM

#### [MEDIUM] M1 — gemini-setup.md §2.3 skips scope registration on OAuth consent screen

- **File:** `plans/gemini-setup.md`
- **Line:** 85
- **Anchor:** `- Skip Scopes, Test users, etc. for now → **Save and`
- **What:** The setup doc instructs the developer to skip the Scopes page entirely during OAuth consent screen configuration; the research doc (`plans/gemini-integration-research.md` §1.1, step 3) explicitly says to add `generative-language.retriever` (and optionally `cloud-platform`) to the consent screen's scope list — which is what populates the consent dialog shown to the user when `chrome.identity.getAuthToken({ interactive: true })` is first called.
- **Why it matters:** If no scopes are registered on the consent screen, Google may show a blank scope list in the consent dialog, trigger an "unregistered scope" error, or in Testing mode silently allow the token (leaving scope coverage uncertain). A developer following the setup doc exactly may get an OAuth error at smoke-test time (§5) without a clear path to diagnosis.
- **Proposed fix:** Replace "Skip Scopes, Test users, etc. for now" with a two-sentence instruction: "On the Scopes page, click **Add or Remove Scopes** → paste `https://www.googleapis.com/auth/generative-language.retriever` → click **Update** → Save and Continue." The test-user addition in the left rail can remain as-is after the wizard.
- **Source critic:** adversary
- **Source axis:** 10. Setup doc usability

#### [MEDIUM] M2 — Key-generation command in setup.md §1 uses PKCS1 format, diverging from research doc §1.3

- **File:** `plans/gemini-setup.md`
- **Line:** 29
- **Anchor:** `openssl genrsa -out .proclivity-key.pem 2048`
- **What:** The setup doc uses `openssl genrsa -out .proclivity-key.pem 2048` (produces a PKCS1/TRADITIONAL RSA private key), while the research doc §1.3 uses `openssl genrsa 2048 | openssl pkcs8 -topk8 -nocrypt -out proclivity-ext.pem` (produces a PKCS8 private key). Both produce an identical DER-encoded public key when exported with `-pubout -outform DER`, so the extension ID is unaffected. The inconsistency creates developer confusion when cross-referencing the two docs.
- **Why it matters:** A developer who generates the key with `openssl genrsa` (PKCS1) and then tries the `openssl pkcs8` command from the research doc to verify will get an "already in correct format" warning that looks like an error; the key rotation instructions in the Rotation section inherit the same inconsistency.
- **Proposed fix:** Standardize on the research doc's PKCS8 pipeline in `gemini-setup.md` §1: `openssl genrsa 2048 | openssl pkcs8 -topk8 -nocrypt -out .proclivity-key.pem`. This produces a more portable format and matches the research doc exactly. Alternatively, add a parenthetical: "(PKCS1 format; functionally identical to the PKCS8 form in gemini-integration-research.md §1.3)."
- **Source critic:** adversary
- **Source axis:** 10. Setup doc usability

### LOW

_None._

## What was done well

- The manifest delta is minimal and correct: only the four fields required by the ACs were added (`key`, `identity` permission, `oauth2` block, `host_permissions`), with no speculative extras. The `"identity"` permission was correctly added (not `"identity.email"` or a broader variant).
- The extension ID was independently verified by re-running the openssl pipeline against the committed `key` string; the result `cpflcminmnekdfjpmdhgblbolmclcdkk` matches the commit message's claim exactly. This is the hardest correctness property in the milestone to verify and it passes.
- The `OAUTH_CLIENT_ID_PLACEHOLDER` constant pattern (`manifest.config.ts` line 20) is the right approach for a single-developer project: the build passes with the placeholder, the comment explains the lifecycle, and a future `gemini-m2` Settings UI can fail fast and clearly when the placeholder is still present.
- The `*.pem` gitignore rule is broad and correct: it prevents both the primary key (`.proclivity-key.pem`) and any accidentally generated variants from entering git history, without being so specific that a renamed file slips through.
- The commit is GPG-signed (`G` status), landed on `main` per project policy, has the correct conventional-commit prefix (`feat(build)`), a 43-char subject (within the 50-char limit), and the required co-author trailer.
- No new npm dependencies were introduced. The bundle delta is purely manifest JSON (+0.69 kB), leaving all JS chunk sizes untouched. `npm run build` is reported clean with zero TypeScript errors.
- `plans/gemini-setup.md` §1 correctly instructs the developer to confirm the PEM file is gitignored before proceeding — a simple but effective guard against accidental key leakage.
- The "Open question — scope coverage" section at the end of `gemini-setup.md` is transparent about the `generative-language.retriever` vs `cloud-platform` ambiguity and gives a clear failure-mode (`403 Forbidden`) and fix (`add cloud-platform`). This matches the research synthesis's open question #1 guidance exactly.
- The rotation/regeneration section in `gemini-setup.md` is clear that rotating the key changes the extension ID and requires re-registering the OAuth Client ID — a critical fact that is easy to forget and was explicitly surfaced.
- External writes are correctly deferred: `state.json` lists them as `external_writes_required` but not `authorized` or `completed`, and the commit message explicitly acknowledges this boundary.

## Recommended rectification order

H1, M1, M2

## Phase 4 status (filled by orchestrator at rectify time)

- Fixed: —
- Deferred: —
- Invalidated: —
- Regression tests added: —
