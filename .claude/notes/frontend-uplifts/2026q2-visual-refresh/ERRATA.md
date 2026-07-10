# ERRATA — motion-token namespace (added 2026-07)

The briefs and synthesis catalog in this run were written **before** the motion-token
namespace split. Their bare `[MOT-N]` tags refer to the **retired repo-local table**
(then at `.claude/references/frontend-uplift/motion-vocabulary.md`), **not** the fleet
canon that `[MOT-N]` now means.

Nothing in this run is wrong; it is simply written in an older vocabulary. This file
exists so the tags are not silently misread against the canon.

## Why it matters

The two tables overlapped on 26 ids and agreed on none of them. The sharpest example:

| id | meant here, in this run | means today, in the canon |
|---|---|---|
| `MOT-31` | `magnetic-cursor` | `floating-orbs` |
| `MOT-65` | `floating-orbs` | *(canon has no MOT-65)* |
| `MOT-14` | `tick-flash` | `shared-element-transition` |
| `MOT-11` | `gradient-shift` | `scale-out` |
| `MOT-12` | `cursor-tracking-spotlight` | `crossfade` |
| `MOT-50` | `section-fade` | `undo-toast` |

## How to read this run

1. Eight ids were shared primitives all along. Translate them via
   `.claude/references/frontend-uplift/motion-extensions.md` §1:
   `MOT-1`→`MOT-1`, `MOT-3`→`MOT-3`, `MOT-4`→`MOT-4`, `MOT-11`→`MOT-32`,
   `MOT-20`→`MOT-39`, `MOT-31`→`MOT-27`, `MOT-51`→`MOT-14`, `MOT-65`→`MOT-31`.
2. Every other `[MOT-N]` in this run is a Proclivity-only primitive. Read it as
   `[PMOT-N]` with the same number — see `motion-extensions.md` §2.
3. `[MOT-NO-N]` anti-pattern tags are now `[PMOT-NO-N]`.

The artifacts themselves are left unedited: they are the durable record of what the
scouts actually said at the time.
