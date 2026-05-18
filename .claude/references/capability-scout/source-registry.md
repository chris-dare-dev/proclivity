# Capability-scout source registry

**Purpose:** the curated list of sources each scout reaches for first.  Update here when a new platform / venue / repo proves valuable.

This file is loaded by individual scouts at Phase 1 start (NOT by the main session at command load time).  Keep entries one-line-per-source so a scout can grep this file for relevant rows when it has a narrow topic.

---

## Competitive landscape (productivity / personal-planning + new-tab + extension UX)

| Platform | URL | Why it matters | Notable capabilities to study |
|---|---|---|---|
| Linear | https://linear.app/ | Best-in-class personal/team issue & sprint planning | Cycles, command-K, keyboard-first flows, opinionated defaults, micro-animation tempo |
| Notion | https://www.notion.so/ | Flexible block-based personal planner | Blocks, databases, templates, slash-menu, calendar/kanban views |
| Todoist | https://todoist.com/ | Mature personal todo flagship | Natural-language input ("tomorrow at 5pm"), filters, karma, project hierarchy |
| TickTick | https://ticktick.com/ | Power-user todo + habit + timer | Pomodoro, habit tracker, eisenhower matrix, calendar integration |
| Things 3 (Cultured Code) | https://culturedcode.com/things/ | Reference for refined personal task UX | Magic Plus button, Today vs Upcoming, project review flow |
| OmniFocus | https://www.omnigroup.com/omnifocus | Power-user GTD reference | Perspectives, forecast view, defer dates, review cadence |
| Sunsama | https://sunsama.com/ | Daily-planning + time-blocking | Daily plan ritual, time-blocked calendar, focus mode |
| Akiflow | https://akiflow.com/ | Calendar + task unified inbox | Triage inbox to calendar, command palette, keyboard nav |
| Motion (usemotion.com) | https://www.usemotion.com/ | AI-assisted auto-scheduling | Auto-rescheduling around meetings, priority bumping |
| Reclaim.ai | https://reclaim.ai/ | Calendar-aware task scheduling | Habits, decision-tree priorities, auto-defragmenting calendar |
| Cron / Notion Calendar | https://calendar.notion.so/ | Modern personal calendar UX | Smooth pane transitions, time-grid responsiveness, keyboard flows |
| Fantastical | https://flexibits.com/fantastical | Reference for natural-language event entry | NLP event entry, full calendar set + reminders unified |
| Amie | https://amie.so/ | Calendar + tasks personal planner | Drag-tasks-to-calendar pattern, day plan rituals |
| Centered | https://www.centered.app/ | Focus / flow-state planner | Single-task focus mode, pomodoro variants |
| Raycast | https://www.raycast.com/ | Best-in-class command palette + extensions | Cmd-K ergonomics, keyboard-driven flows, extensions surface |
| Arc Browser site | https://arc.net/ | Marketing-grade visual language | Sidebar nav, spaces, command-bar (Cmd-T) — pattern reference |
| Tab Manager Plus / Workona / Toby | various | Tab/session-management extensions | Workspace-as-first-class, session restore, tab-grouping |
| Momentum Dashboard (extension) | https://momentumdash.com/ | Reference new-tab "dashboard" replacement | Daily focus, quote-of-day, weather widget, single-question prompt |
| Tabliss (OSS new-tab) | https://tabliss.io/ | OSS new-tab extension reference | Modular widgets, configurability, performance |
| Habitica | https://habitica.com/ | Gamified habit + todo | Game mechanics applied to habit tracking |

**How to mine these:** each scout WebFetches the platform's public docs / feature pages / changelog / pricing pages.  Public-blog and changelog entries are the high-value text sources; the home page is mostly marketing.

---

## Productivity / personal-planning research venues

| Venue | URL pattern | Coverage |
|---|---|---|
| ACM CHI (Human Factors in Computing) | https://chi.acm.org/ | Personal-information-management research; task / planning studies |
| ACM CSCW | https://cscw.acm.org/ | Personal & collaborative productivity research |
| UIST (User Interface Software & Technology) | https://uist.acm.org/ | Novel interaction patterns; calendar / agenda / list UIs |
| arXiv cs.HC | https://arxiv.org/list/cs.HC/recent | Daily new HCI papers; primary signal for new techniques |
| Behaviour & Information Technology (T&F) | https://www.tandfonline.com/journals/tbit20 | Time-management / attention-management empirical work |
| Nielsen Norman Group | https://www.nngroup.com/ | Industry-leading usability research; lots of free articles |
| Smashing Magazine — UX & productivity | https://www.smashingmagazine.com/category/ux/ | Practitioner-leaning patterns + case studies |
| Cal Newport (Deep Work / time-blocking) | https://calnewport.com/blog/ | Methodology source: time-blocking, daily plan ritual |
| David Allen — Getting Things Done | https://gettingthingsdone.com/ | The reference methodology for personal task systems |
| The Pomodoro Technique (Francesco Cirillo) | https://francescocirillo.com/products/the-pomodoro-technique | The reference method for focus intervals |
| Tiago Forte — Building a Second Brain | https://www.buildingasecondbrain.com/ | Personal knowledge management framework |
| Cortex / Maker schedule research | https://www.paulgraham.com/makersschedule.html | Maker vs manager schedule (foundational reference) |

**Time-window discipline:** scouts cite research from the **last 24 months** by default.  Older citations only when they're foundational (GTD 2001, Pomodoro 1980s, etc.) AND not already considered in `plans/`.

---

## OSS / GitHub trends (productivity extensions + MV3 ecosystem)

| Project | URL | License | Why it matters |
|---|---|---|---|
| Tabliss | https://github.com/joelshepherd/tabliss | MIT | Modular OSS new-tab extension (TS + React); direct competitor reference |
| Marinara (Pomodoro extension) | https://github.com/schmich/marinara | GPL-3.0 | Reference MV2→MV3 timer-style extension |
| Toby (closed-source but referenced widely) | https://www.gettoby.com/ | proprietary | Tab/session-organizer pattern |
| Workflowy | https://workflowy.com/ | proprietary | Infinite-outliner pattern reference |
| Logseq | https://github.com/logseq/logseq | AGPL-3.0 | OSS personal knowledge graph; study-only (AGPL non-import) |
| Anytype | https://github.com/anyproto | Various | Local-first knowledge / planning app |
| Tana (web, closed) | https://tana.inc/ | proprietary | Modern outliner + supertags + nodes |
| Reor | https://github.com/reorproject/reor | AGPL-3.0 | Local AI-powered note app; study-only |
| Obsidian (web/desktop, freemium) | https://obsidian.md/ | proprietary | Local-first markdown PKM |
| Foam (VS Code based) | https://github.com/foambubble/foam | MIT | OSS Roam-like in VS Code |
| Excalidraw | https://github.com/excalidraw/excalidraw | MIT | OSS drawing/whiteboard; pattern reference for canvas-based interaction |
| react-window / react-virtual | https://github.com/bvaughn/react-window , https://tanstack.com/virtual | MIT | Virtualization for long todo lists |
| dexie / idb-keyval | https://github.com/dexie/Dexie.js , https://github.com/jakearchibald/idb-keyval | Apache-2.0 / Apache-2.0 | Local-storage / IndexedDB toolkits |
| chrome-types (TS) | https://github.com/GoogleChrome/chrome-types | Apache-2.0 | Chrome API TypeScript types |
| @crxjs/vite-plugin (in use) | https://github.com/crxjs/chrome-extension-tools | MIT | MV3 build pipeline for Vite (already in Proclivity) |
| crx-hotreload | https://github.com/xpl/crx-hotreload | MIT | MV3 dev-experience helpers |

**License discipline:** every OSS reference cites license verbatim.  GPL/AGPL is a non-import flag — fine to study, NOT fine to vendor.

---

## On-device AI / Chrome AI APIs / agentic assistants

Proclivity already integrates Gemini.  These sources cover the broader on-device AI / Chrome AI ecosystem.

| Source | URL | Topic |
|---|---|---|
| Chrome built-in AI (Prompt, Summarizer, Writer, etc.) | https://developer.chrome.com/docs/ai/built-in | Origin-trial APIs; Gemini Nano model exposure |
| Gemini Nano on-device docs | https://developer.chrome.com/docs/ai/built-in-apis | API surface, language coverage, capability matrix |
| Prompt API origin trial | https://developer.chrome.com/origintrials | Active origin trials for AI APIs |
| Translation API (Chrome) | https://developer.chrome.com/docs/ai/translator-api | On-device translation |
| Summarizer API (Chrome) | https://developer.chrome.com/docs/ai/summarizer-api | On-device summarization |
| Writer / Rewriter API (Chrome) | https://developer.chrome.com/docs/ai/writer-api | On-device drafting / rewriting |
| Web NN | https://webnn.dev/ | Standard for on-device neural inference |
| Web LLM / WebGPU LLMs | https://webllm.mlc.ai/ | Running LLMs entirely in-browser via WebGPU |
| transformers.js (Xenova) | https://github.com/huggingface/transformers.js | ONNX inference in the browser |
| llama.cpp | https://github.com/ggerganov/llama.cpp | C++ inference reference; foundational for many on-device stacks |
| ONNX Runtime Web | https://onnxruntime.ai/docs/get-started/with-javascript/web.html | ONNX in the browser |
| Mozilla — local first principles | https://www.inkandswitch.com/local-first/ | The architectural pattern Proclivity already follows |

**Survey heuristic:** prioritize APIs / libraries that work entirely on-device.  Anything requiring a hosted endpoint is OUT OF SCOPE per Proclivity's local-only constraint.

---

## Proclivity codebase orientation (read first by every scout)

| Path | What it is | Why a scout reads it |
|---|---|---|
| `/CLAUDE.md` | Top-level project conventions | Branch rules, build gates, "what agents must not do" |
| `/AGENTS.md` | Pointer to CLAUDE.md | Confirms there are no separate external-write rules to learn |
| `/.claude/CLAUDE.md` | Project-scope agent instructions | State-file layout, agent memory, external-write boundary |
| `/manifest.config.ts` | Chrome MV3 manifest | Current permissions, content scripts, action surface |
| `/src/newtab/` | The new-tab entry point | Top-level React tree |
| `/src/sections/` | Today / Sprint / LongTerm / Gantt / Reminders / Photos / Calendar | The platform's current capability surface |
| `/src/background/` | Service worker | Reminder scheduling, alarms, notifications |
| `/src/storage/` | `chrome.storage.local` wrapper + `useStore` hook | Current persistence shape — 10MB cap |
| `/src/llm/` | Gemini integration | Existing AI surface; what's already wired |
| `/plans/` | Active and historical roadmaps | What's already in flight; what's been considered |
| `/.claude/notes/` | Prior research / design / critique artifacts | Recurring failure modes; closed-vs-open critiques |

The **current-state adversary** (Phase 1 scout #5) is responsible for end-to-end traversal of these.  The other four scouts do quick orientation reads, then focus their attention externally.

---

## Hard rules (every scout)

- **License citation is mandatory** for every OSS reference.
- **Citation format for papers:** `arXiv:NNNN.NNNNN` (or DOI) + year + 1-sentence finding.
- **Time-window:** last 24 months unless the older work is genuinely foundational AND not already documented in `plans/` or `.claude/notes/`.
- **No speculation about Proclivity internals.**  Every "Proclivity already does X" or "Proclivity doesn't do X" claim has a `file:line` citation.
- **No vendor-blog hype.**  If a source's only evidence is its own marketing page, weight it accordingly.
- **Boundary respect:** scouts do NOT write code; they write briefs.
- **Local-only respect:** never propose a server-backed, hosted-endpoint, cross-device-sync, or telemetry-emitting capability.  Per `CLAUDE.md` these are non-starters.
