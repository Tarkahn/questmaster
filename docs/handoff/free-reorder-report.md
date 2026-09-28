# Handoff: free-reorder — report

Builder candidate. Plan `docs/plans/free-reorder.md`, implement handoff
`docs/handoff/free-reorder-implement.md`.

## Branch and commit

- questmaster: branch `free-reorder`, `f48de8083a50ee7a75aa8b1216beff5ef779cef1`
  (cut from `main` at `cf70418`)
- questmaster-standalone: branch `free-reorder`, `862fe31c72413a0c703b03c9f89661b4c8830fb4`
  (cut from `main` at `e116224`)

Two commits per repo: ordering logic + pure-function tests, then the
Dashboard wiring. `recurring.js` is untouched in both — still byte-identical
(`diff` confirmed).

## What changed

One `computeOrder` function (`src/utils/taskOrder.js`, both apps) replaces
`computeDisplayOrder`/`computeAutoSortOrder`/`computeCombinedOrder`. It's fed
"entries" (quests, optionally plus missions for Full List) and the saved
order, and:
- resorts locked entries (dated quests, missions, spawned-with-a-time
  recurring quests) into strict time order, in whatever slots they occupy
- leaves free entries (no date, no time) exactly where the saved order put
  them
- with Auto-sort on, only re-orders *undragged* free entries by staleness;
  dragged free entries and all locked entries are untouched

A quest's order key is its task id, except a spawned recurring instance,
keyed by its stable recurring-definition id (`keyForTask` +
`defIdByTaskId`) so a new daily spawn inherits the old slot.
`canonicalizeOrder` migrates an old saved order that still holds a
recurring instance's raw (pre-fix) task id.

Both views (main list, Full List) and both Auto-sort states now go through
the same `computeOrder` call, fed the same saved order — a placement made in
one view holds in the other. Full List gained its own
`DragDropContext`/`Droppable` (it had none before); locked entries render
with no drag handle in both views. `reorderSavedOrder` lets a drag in one
view move a key without dropping keys the other view doesn't show (e.g.
missions, hidden from the main list).

Day-heading grouping (`groupCombinedByDay`) now assigns each free entry the
heading of the next locked entry in the final order; a free entry after
every locked entry falls into the trailing "No date" group.

The saved-order payload gained a `dragged: []` field (which free quests Rick
has manually dragged); `loadTaskOrder`/`saveTaskOrder`/`saveTaskOrderRaw`
default it for old payloads. Quest creation and a recurring definition's
first-ever spawn both slot into the saved order per `newQuestPosition`
(top/bottom); every later spawn reuses the same key automatically.

The literal string `qm-free-reorder` is on both Droppables' `data-` attribute
names, so it survives minification — confirmed with
`grep qm-free-reorder dist/assets/index-*.js` in both apps' production
builds.

## What I ran

**Pure-function tests** (`node scripts/test-free-reorder.mjs`, both apps —
no test runner in either repo): 9/9 pass in each, covering acceptance checks
A–C, D, E, F, G, plus `reorderIds`/`reorderSavedOrder` sanity checks.

**Builds:** `npm run build` passes in both apps; marker string confirmed in
both production bundles.

**Live in standalone** (`npm run dev -- --port 5202 --strictPort` +
`npm run worker:dev`, local D1, fresh test account): created 2 dated
quests, 1 recurring quest (no time, spawns free), 2 free quests, 1 mission
today.

- @hello-pangea/dnd didn't respond to the browser-automation mouse-drag
  gesture (a known limitation with this class of drag library and synthetic
  pointer events), so I drove its keyboard sensor instead — dispatching
  Space/ArrowDown/ArrowUp KeyboardEvents at the focused drag handle. That's
  the same `handleDragEnd`/`handleCombinedDragEnd` code path a mouse drag
  fires; only the input method differs.
- **A** (confirmed): dragged a free quest between a free and a dated quest
  in the main list; reloaded the page; it held position, dated items stayed
  in date order.
- **B** (confirmed, both views): dragging a free quest to every reachable
  slot never changed the two locked items' relative order.
- **E** (confirmed, both directions): in Full List, dragged a free quest to
  sit between two locked items (a mission and a dated quest) spanning a day
  boundary — it landed there, and its day heading followed it. Turned Full
  List off — the main list showed the same relative order (free quest after
  the dated quest, missions simply absent).
- **F** (partially confirmed): turned Auto-sort on via the settings
  payload; the already-dragged free quest stayed in its slot and the locked
  item stayed in time order. Only one undragged free quest existed in the
  test data, so the "auto-order several undragged free quests around it"
  half of the rule wasn't exercised live — it's covered by the
  `test-free-reorder.mjs` pure-function test instead.
- **I** (confirmed): added 2 side quests to a free quest, turned Full List
  on, expanded them, and keyboard-dragged one side quest above the other —
  the nested `DragDropContext` still works inside Full List's new outer one.
  No console errors during any of this session's testing.
- **C** (recurring keeps its slot across a spawn) and **D** (timed
  recurring quest is locked and time-sorts): not re-exercised live —
  simulating a real next-day spawn needs advancing the worker's clock, which
  I didn't want to fake. Both are covered by the pure-function tests, and D
  is indirectly confirmed live: the mission (due today) and a dated quest
  (due Sep 30) correctly resorted by real deadline when the mission was
  added after the dated quest already had a saved position.
- **G** (old saved-order formats): pure-function tests only; I didn't have
  a pre-existing account with an old-format saved order to migrate live.

No paid AI calls were made — recurring-quest spawns didn't trigger the theme
endpoint in this session (recurring titles hadn't been sent to the LLM
before I created them, but no re-theming showed up as a paid call in the
worker logs beyond the initial creation).

## What only the live site can settle

questmaster's quest list needs Google sign-in, which only runs on Vercel —
not checkable from this worktree. `npm run build` passes there and the
ordering logic is identical (same `computeOrder`, same test suite, same
Dashboard wiring pattern) to the standalone code just verified live, but the
questmaster-specific glue (Google Tasks `due`/notes-embedded `qm-time` tag,
Drive sync) needs a live check.

## Stopped

Both dev servers (`vite --port 5202`, `wrangler dev`) stopped. No source
changes remain from the live-testing session (confirmed with `git status`).

## Live result (lead, 2026-09-28)

Checker verdict PASS (qitem-20260928152925-04b95707). Fast-forwarded and pushed:
questmaster `2926ef9..db0ca53`, standalone `e116224..862fe31`.

- questmaster: newest Vercel production deployment READY; marker
  `qm-free-reorder` found in the bundle served at questmaster-rouge.vercel.app
  (`/assets/index-DlgxwSI9.js`).
- standalone: "Deploy Worker" run for 862fe31 succeeded; marker found at
  go.tarkahn.cc (`/assets/index-Dy4aSKwP.js`).
- Not yet confirmed by use: questmaster's Google-signed-in list behaviour
  (Google Tasks date/time glue, Drive sync of the order), and day-rollover
  cases C and D in either app. Rick's first use covers these.
- Spend: the checker made 1 paid theme call (a manual "+ New Quest"); the
  builder made none.

This section is committed on local `main` only; it goes out with the next push.
