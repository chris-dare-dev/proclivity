# Rectify summary — gemini-m1

## Findings status

- **H1** — SECURITY.md drift (stale permissions table, false `host_permissions` claim, stale audit checklist). **FIXED** in this rectify commit. Updates: §2 permissions table now lists `identity`, adds new sub-sections for `host_permissions` and the `oauth2` block; §3 reframes "no data leaves the device" with a forward-looking note about the upcoming Gemini integration; §7 reworks the "never add host_permissions" and "never introduce fetch" rules to permit only the single sanctioned Gemini host; §9 audit checklist items 1 and 3 are rewritten to be narrow-host-aware, and a new item is added for the `oauth2.scopes` array.
- **M1** — `gemini-setup.md` §2.3 skips Scopes registration on the OAuth consent screen. **FIXED**. Replaced the "Skip Scopes" instruction with an explicit two-sentence procedure to add `generative-language.retriever` to the consent screen's scope list, including the rationale (Google can't populate the consent dialog without it).
- **M2** — `gemini-setup.md` §1 used PKCS1 key-generation, inconsistent with `plans/gemini-integration-research.md` §1.3's PKCS8. **FIXED**. Setup doc now uses `openssl genrsa 2048 | openssl pkcs8 -topk8 -nocrypt -out .proclivity-key.pem` (PKCS8). Added a one-sentence note that the two formats produce identical public keys, so the existing PKCS1 key file on the maintainer's disk continues to work without re-generation.

## Invalidated findings

None. All three findings were re-verified against live code before fixing.

## Regression tests added

None. The rectify commit is **doc-only** (touches `SECURITY.md` and `plans/gemini-setup.md` exclusively). `check-rect-tests.sh` exempts doc-only commits per its `*.md`-only branch. The fixes are content corrections; no behavioral surface to regression-test.

## Re-verification

- `npm run build` — clean (177.37 kB initial chunk; no delta from pre-rectify state).
- `grep -n "host_permissions" SECURITY.md` — now references the narrow Gemini host, no longer contains "No host_permissions are declared".
- `grep -n "Skip Scopes" plans/gemini-setup.md` — no hits.
- `grep -n "openssl genrsa" plans/gemini-setup.md` — single hit on the new PKCS8 line.
