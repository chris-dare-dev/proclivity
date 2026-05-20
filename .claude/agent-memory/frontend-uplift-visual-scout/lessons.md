# Visual Scout Lessons

## 2026-05-20 — Run: 2026q2-visual-refresh

- `mcp__Claude_Preview__*` tools were not available in this agent session; fell back to `npx playwright screenshot` (CLI) + headless Playwright JS (via npx cache at `~/.npm/_npx/e41f203b7505f1fb/node_modules/playwright`). Install chromium first with `npx playwright install chromium` if not present.
- Proclivity's dev server returns 404 at `/` but serves correctly at `/src/newtab/index.html`. Always use the full path when navigating.
- `chrome.storage.local` is unavailable in plain headless Chromium; the app falls back to `localStorage` (see `src/storage/storage.ts:13`). Inject mock state via `context.addInitScript` setting `localStorage["proclivity:state:v1"]` before page load to populate representative todos/sprints/reminders.
- The Sprint section requires `activeSprintId` in the mock state (matches a sprint id in `sprints[]`) to render the sprint view; without it the section is blank.
- `todo-edit` button is opacity:0 at rest — requires a `.hover()` on the `<li>` element before the button becomes clickable in Playwright. Use `li.todo-item` selector.
- The WebGL mesh background (`MeshBackground.tsx`) generates `GL Driver Message: GPU stall due to ReadPixels` console warnings in headless Chromium — these are GPU-driver performance hints, not errors; safe to note but not a CRITICAL finding.
- All 8 canonical views rendered correctly and produced screenshots; no view was broken or unrenderable.
