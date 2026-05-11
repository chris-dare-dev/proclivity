# Canonical critique format

Every critic writes a markdown file matching this exact shape. The dedup script (`dedupe-findings.py`) parses by section heading and the per-finding template.

## File layout

```markdown
# Critique — <id> — <critic-name>

**Critic:** <adversary | web-perf-reviewer | infra-auditor | lfs | oss-scout>
**Commit range:** <base-sha>..<head-sha>
**Generated:** <RFC3339 timestamp>
**Diff stats:** <files-changed>, <loc-changed>

## Verdict

One of: SHIP / SHIP-WITH-FIXES / DO-NOT-SHIP

(One paragraph, ≤ 4 sentences, justifying the verdict.)

## Executive summary

- ≤ 8 bullets summarizing the most important findings.
- Each bullet starts with severity in brackets, e.g. `[CRITICAL]`.
- Concrete; no hedging.

## Findings

### CRITICAL

(Zero or more findings, each in the per-finding template below.)

### HIGH

(Zero or more findings.)

### MEDIUM

(Zero or more findings.)

### LOW

(Zero or more findings.)

## What was done well

(REQUIRED. 5–10 bullets. Empty section = adversarial-for-its-own-sake; will be re-dispatched.)

## Recommended rectification order

(Ordered list of finding ids, e.g. `C1, C2, H1, H3, H2, M1`. Phase 4 follows this order by default.)

## Phase 4 status (filled by orchestrator at rectify time)

- Fixed: <finding ids>
- Deferred: <finding ids>
- Invalidated: <finding ids with reasons>
- Regression tests added: <file paths>
```

## Per-finding template

Each finding is one block. The dedup script depends on this exact shape.

```markdown
#### [SEVERITY] <Finding id> — <Short title under 70 chars>

- **File:** `path/to/file.ext`
- **Line:** <integer or range>
- **Anchor:** `<first 40 chars of cited line, verbatim, in backticks>`
- **What:** <One sentence describing what is wrong.>
- **Why it matters:** <One sentence on the consequence — production break, perf regression, doc drift, etc.>
- **Proposed fix:** <One short paragraph; pseudo-code or one-line patch is fine.>
- **Regression-guard:** <For CRITICAL + HIGH: name the test, assertion, or snapshot that would catch a regression. For MEDIUM + LOW: optional.>
- **Source critic:** <adversary | web-perf-reviewer | infra-auditor | lfs | oss-scout>
- **Source axis:** <axis name from severity rubric, if applicable>
```

## Finding id convention

`<severity-letter><serial>` per critique file:

- `C1, C2, ...` — CRITICAL
- `H1, H2, ...` — HIGH
- `M1, M2, ...` — MEDIUM
- `L1, L2, ...` — LOW

After dedup, ids are renumbered uniquely across the merged document. Cross-critic-agreement findings get an `[AGREEMENT]` tag and are upgraded one severity level.

## Severity calibration anchors

(Cross-reference; full rubric in `references/agent-prompts.md`.)

- **CRITICAL** = production breaks (e.g. `<Image priority>` prop, external write without authorization, rect commit unsigned).
- **HIGH** = likely-to-cause-incident bug, build break in non-default config, test gap masking known failure class.
- **MEDIUM** = subtle bug, perf regression, or doc drift; fix only if cheap.
- **LOW** = style, naming, micro-opt; defer by default.

If a critic cannot map a finding to a clear analog from the rubric, demote one level. Never invent a CRITICAL.

## Worked example (small)

```markdown
#### [HIGH] H1 — Article added to articles.ts but no MDX file

- **File:** `web/src/content/articles.ts`
- **Line:** 42
- **Anchor:** `  { slug: "new-thing", title: "On New Things",`
- **What:** New article entry added to System A but `web/content/posts/new-thing.mdx` is missing.
- **Why it matters:** Clicking the article on `/articles` index will 404. Dual content system desync per CLAUDE.md "Dual article content systems".
- **Proposed fix:** Create `web/content/posts/new-thing.mdx` with frontmatter matching velite schema. Use `/new-article` skill — it handles both files at once.
- **Regression-guard:** Add a bun test that asserts every entry in `articles.ts` has a corresponding non-draft entry in velite output (`posts.find(p => p.slug === a.slug && !p.draft)`).
- **Source critic:** adversary
- **Source axis:** 3. Dual content system
```
