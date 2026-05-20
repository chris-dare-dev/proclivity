
## frontend-uplift-2026q2 (2026-05-20)
- The handoff section scaffold uses `{{FIRST_MILESTONE}}` placeholders — the validator S002 check fires on these even when all other sections are clean; always substitute placeholders in the handoff section BEFORE running the validator, not after.
- When `--gh-issues` is false, populate the tracking section table note to "Not requested (run with --gh-issues to bundle epic + story bodies)" rather than leaving the default scaffold text — this keeps the section semantically complete and avoids any future false-positive placeholder scan.
- Roadmaps with a large upstream RICE/scoring report embedded in §1 (the "Brief" section) are still valid — the validator does not flag this as a template pollution issue; the section is treated as free-form text once the `<!-- ROADMAP:section:refine -->` marker is present.
- For roadmaps where `Confidence=50%` is noted on the single Must epic (Confidence ceiling due to single-source evidence), ensure the RICE table includes the `*` footnote inline so the sequencer's reasoning is self-documenting; the validator does not enforce this but it preserves traceability.
- The `--advance complete` call to `init-roadmap.sh` is the final gate: if it exits non-zero, the roadmap MUST NOT be reported as complete; treat a state-advance failure as `aborted-scope` regardless of whether the doc looks correct.
