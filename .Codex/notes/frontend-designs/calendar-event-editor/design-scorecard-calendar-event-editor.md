# Design scorecard — calendar-event-editor

**Surface:** Calendar / Create event
**Scope:** small
**Thesis:** Creating a Proclivity event should feel like writing a dated field note directly into the planning instrument: the chosen day stays explicit, details unfold in one calm sheet, and the save outcome is unmistakably local.
**Direction:** Dated Field Note
**Persisted:** commit-body
**Scorecard format version:** 2.0

Anti-pattern verdicts: 1 (tell present) / 0 (absent). Quality verdicts: 0-4. Evidence uses `✓ live`, `✓ code`, or `~ inferred` tiers.

## Self score — anti-pattern tells

| # | Tell | Verdict | Evidence |
|---|---|---|---|
| 1 | near-navy shell with multiple neon accents (BAN-1) | 0 | ✓ live calendar-event-editor-desktop-dark.png shows an achromatic sheet with one restrained user accent. |
| 2 | six or more equal rounded cards as the primary layout (BAN-2) | 0 | ✓ live calendar-event-editor-desktop-dark.png shows one calendar work surface and one transient editor sheet. |
| 3 | icon-in-rounded-square decoration tiles (BAN-3) | 0 | ✓ code src/sections/Calendar.tsx:198 uses one plus icon to clarify the visible New event action. |
| 4 | untouched default component-library appearance (BAN-4) | 0 | ✓ code src/sections/calendar/calendar.css:660 authors the date rail, field hierarchy, local marker, tonal action, and responsive sheet. |
| 5 | no focal element or equal panel weight (BAN-5) | 0 | ✓ live calendar-event-editor-desktop-dark.png makes the title field focal, with time and optional details stepping down. |
| 6 | decorative unannotated charts (BAN-6) | 0 | ✓ code src/sections/calendar/CalendarEventModal.tsx:111 contains no chart or decorative data display. |
| 7 | badge soup with more than five colored chips (BAN-7) | 0 | ✓ live calendar-event-editor-desktop-dark.png uses one compact LOCAL EVENT marker that communicates storage source. |
| 8 | glow, gradient, or glass without a layering reason (BAN-8) | 0 | ✓ live calendar-event-editor-desktop-dark.png uses an opaque sheet and overlay shadow only for transient modal elevation. |
| 9 | multiple primary calls to action per viewport (BAN-9) | 0 | ✓ live calendar-event-editor-desktop-dark.png presents Create event as the single primary action. |
| 10 | generic or cosplay copy (BAN-10) | 0 | ✓ live calendar-event-editor-desktop-dark.png uses exact field labels and explicitly says Google and Outlook are unchanged. |
| 11 | semantic colors used decoratively (BAN-11) | 0 | ✓ live calendar-event-editor-validation-dark.png reserves danger color for the required-title error and accent for focus/action. |
| 12 | uniform density with no authored modes (BAN-14) | 0 | ✓ code src/sections/calendar/calendar.css:768 switches the two-column time row to a one-column mobile editor while preserving the compact calendar behind it. |
| 13 | same-silhouette syndrome from another surface (BAN-15) | 0 | ✓ live calendar-event-editor-desktop-dark.png gives the shared modal a product-specific dated-field-note hierarchy and local-storage disclosure. |

**Self anti total:** 0/13

## Self score — directed quality

| # | Dimension | Score (0-4) | Evidence |
|---|---|---|---|
| 1 | Task clarity — selected day and next action are evident in five seconds | 4 | ✓ live calendar-event-editor-desktop-dark.png names the task, selected date, required title, time range, and Create event action without hover. |
| 2 | Priority fidelity — visual weight matches required and optional input | 4 | ✓ live calendar-event-editor-desktop-dark.png gives title and time priority while location and notes remain clearly optional. |
| 3 | Decision integrity — scope, time, location, notes, and side effects are explicit | 4 | ✓ live calendar-event-editor-desktop-dark.png exposes the full local event payload and the read-only imported-calendar boundary. |
| 4 | Composition — each region answers a distinct creation question | 4 | ✓ live calendar-event-editor-desktop-dark.png composes date context, required identity, time, optional detail, disclosure, and actions in one calm sheet. |
| 5 | Typography — roles encode hierarchy at operating density | 4 | ✓ live calendar-event-editor-desktop-dark.png separates title, eyebrow, date, labels, input values, disclosure, and actions legibly. |
| 6 | Semantic depth — layers communicate transient editing and ownership | 4 | ✓ code src/sections/calendar/CalendarEventModal.tsx:114 uses the shared modal layer while the local-event rail and disclosure explain ownership. |
| 7 | Interaction and state craft — entry, validation, focus, save, and cancel are coherent | 3 | ✓ live calendar-event-editor-validation-dark.png proves inline validation and visible focus; desktop double-click, visible button, persistence, and focus restoration were also browser-verified. |
| 8 | Product signature — the surface remains recognizably Proclivity without its logo | 3 | ✓ live calendar-event-editor-desktop-dark.png retains the restrained field-desk voice, one-accent system, and explicit local-first boundary. |

**Self quality mean:** 3.75/4

## Independent score — anti-pattern tells

| # | Tell | Verdict | Evidence |
|---|---|---|---|
| 1 | near-navy shell with multiple neon accents (BAN-1) | 0 | ✓ live calendar-event-editor-desktop-dark.png uses an achromatic ink-and-paper surface with one user accent. |
| 2 | six or more equal rounded cards as the primary layout (BAN-2) | 0 | ✓ live calendar-event-editor-desktop-dark.png retains one calendar work surface plus one transient sheet, not a card wall. |
| 3 | icon-in-rounded-square decoration tiles (BAN-3) | 0 | ✓ code src/sections/Calendar.tsx:198 uses a plus icon only to clarify the visible New event action; there are no repeated icon tiles. |
| 4 | untouched default component-library appearance (BAN-4) | 0 | ✓ code src/sections/calendar/calendar.css:660 authors the date-context rail, field hierarchy, local marker, tonal action, and responsive sheet. |
| 5 | no focal element or equal panel weight (BAN-5) | 0 | ✓ live calendar-event-editor-desktop-dark.png establishes the title as focal and steps time, optional details, disclosure, and actions down clearly. |
| 6 | decorative unannotated charts (BAN-6) | 0 | ✓ code src/sections/calendar/CalendarEventModal.tsx:111 contains no chart treatment in scope. |
| 7 | badge soup with more than five colored chips (BAN-7) | 0 | ✓ live calendar-event-editor-desktop-dark.png uses one compact marker to encode actual source and type rather than decorative status. |
| 8 | glow, gradient, or glass without a layering reason (BAN-8) | 0 | ✓ live calendar-event-editor-desktop-dark.png keeps the sheet opaque and uses shadow only for justified transient-overlay elevation. |
| 9 | multiple primary calls to action per viewport (BAN-9) | 0 | ✓ live calendar-event-editor-desktop-dark.png contains one primary action in the creation state. |
| 10 | generic or cosplay copy (BAN-10) | 0 | ✓ live calendar-event-editor-desktop-dark.png uses exact private, local-only copy. |
| 11 | semantic colors used decoratively (BAN-11) | 0 | ✓ live calendar-event-editor-validation-dark.png restricts danger to errors and accent to ownership, focus, and action. |
| 12 | uniform density with no authored modes (BAN-14) | 0 | ✓ code src/sections/calendar/calendar.css:768 keeps the calendar compact, the editor comfortable, and the mobile layout single-column. |
| 13 | same-silhouette syndrome from another surface (BAN-15) | 0 | ✓ live calendar-event-editor-desktop-dark.png gives shared modal geometry a distinct dated-field-note identity. |

**Independent anti total:** 0/13

## Independent score — directed quality

| # | Dimension | Score (0-4) | Evidence |
|---|---|---|---|
| 1 | Task clarity — selected day and next action are evident in five seconds | 4 | ✓ live calendar-event-editor-desktop-dark.png makes creation purpose, date, required field, time range, and save action immediately legible. |
| 2 | Priority fidelity — visual weight follows required, optional, and contextual information | 4 | ✓ live calendar-event-editor-desktop-dark.png clearly prioritizes title and time above optional detail and disclosure. |
| 3 | Decision integrity — labels, scope, time, and effects are available without hover | 4 | ✓ live calendar-event-editor-desktop-dark.png states all editable facts and that Google and Outlook calendars are not changed. |
| 4 | Composition — distinct regions form one coherent authored sheet | 4 | ✓ live calendar-event-editor-desktop-dark.png shows strong hierarchy across context, fields, disclosure, and actions. |
| 5 | Typography — roles remain consistent and legible | 4 | ✓ live calendar-event-editor-desktop-dark.png maintains consistent label, body, metadata, and action roles. |
| 6 | Semantic depth — layers and accent communicate state rather than decoration | 4 | ✓ code src/sections/calendar/calendar.css:751 scopes the accent treatment to the event submit action while the modal layer remains opaque. |
| 7 | Interaction and state craft — alternatives and validation cover the primary workflow | 3 | ✓ live calendar-event-editor-validation-dark.png demonstrates accessible focus and validation; a visible New event route supplements double-click for keyboard and touch users. |
| 8 | Product signature — local-first planning remains recognizable and route-coherent | 3 | ✓ live calendar-event-editor-desktop-dark.png preserves the Proclivity field-desk language and local/import boundary. |

**Independent quality mean:** 3.75/4

## Verification notes

- Live Chromium verification covered the visible New event route, day-tile double-click, title autofocus, invalid-submit focus, cancel focus restoration, immediate rendering, persistence through reload, details rendering, and data clearing.
- Google and Outlook imports remain read-only and are only merged for display; created events persist in Proclivity storage.
- The independent scorer reported an anti-pattern score of 0/13 and DQS 3.75/4 with no concrete design regression remaining.
