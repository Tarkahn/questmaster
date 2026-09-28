# Handoff: free-reorder — implement

Plan: `docs/plans/free-reorder.md` (read it first; its Rules section is the
spec). Slice branch: `free-reorder`, cut from `main` in **both** builder
worktrees. The slice ends in the lead pushing `main` of both repos after the
checker clears it. Builder never pushes.

Before starting, read the memory index and these notes:
`checklist-reorder-and-focus.md`, `recurring-quest-sync-race.md`,
`haiku-usage-and-theme-cache.md` (theme cache keyed via recurring definition).

## Where things are today (checked 2026-09-28, questmaster line numbers)

- Order logic: `src/utils/taskOrder.js`. `computeDisplayOrder` (58-79) already
  keeps undated quests in manual slots and sorts dated quests into the dated
  slots. `computeCombinedOrder` (120-135) builds Full List with every undated
  quest forced to the end, most-stale first. `computeAutoSortOrder` (96-112).
- Which sort runs: `Dashboard.jsx:1778-1780`
  (`settings.autoSort ? computeAutoSortOrder : computeDisplayOrder`).
- Drag today: main list only, only when Full List is off, and only when
  `!(settings.autoSort || task.due)` (`Dashboard.jsx:2240-2266`, handler
  `handleDragEnd` 1048-1057). Full List rows are rendered with no drag props
  (2229) and grouped by day via `groupCombinedByDay` (113-126).
- Saved order: `{order:[ids], updatedAt}` in localStorage `qm_task_order`,
  synced to Drive `questmaster-taskorder.json` (questmaster) or KV key
  `taskorder` (standalone, `worker/kv.js:158`); newer `updatedAt` wins
  (`Dashboard.jsx:570-581`).
- Recurring spawn: `Dashboard.jsx:695-771`. Instances are created with no `due`
  (a time goes in `dueTime`), get a new task ID each spawn, and are not
  inserted into the saved order. Task-ID-to-definition-ID mapping already
  exists for themes (840-845).
- Side quests drag inside their parent card with a nested `DragDropContext`
  (`TaskItem.jsx:231-279`). Nesting inside an outer `Draggable` is fragile in
  @hello-pangea/dnd — keep it working in Full List too.
- Standalone mirrors this with `dueDate`/`dueTime` field names and renders the
  drag list's `TaskItem` inline (`Dashboard.jsx:2182-2223`). Its D1 `quests.position`
  column is unused for top-level quests; leave it unused.

Re-check these line numbers; they are from a read-only survey, not from you.

## What to build

1. One ordering function used by both views (Full List on/off) and by
   Auto-sort, following the plan's Rules 1-7. Locked vs free:
   - locked = has a date, or has a time with no date (treat as due the day it
     spawned at that time), or is a mission;
   - free = no date and no time.
   Locked items are always in strict time order relative to each other.
2. Order keys: a spawned recurring instance is keyed by its recurring
   definition ID in the saved order, so a new spawn inherits the old one's
   slot. Normal quests stay keyed by task ID. Missions get a stable key too, so
   Rick's placement of a free quest between two missions survives a reload.
   Existing saved orders (plain task-ID arrays, and the legacy bare array) must
   keep loading with Rick's current arrangement intact.
3. Auto-sort (Rule 5): record which free quests Rick has dragged (extend the
   saved order object; stay backward compatible, including the sync merge).
   With Auto-sort on, dragged free quests keep their slot and undragged free
   quests are ordered by the existing urgency score around them.
4. Drag enabled for free quests in Full List (on and off) and with Auto-sort on.
   Locked items show no drag handle. A drop is allowed anywhere; locked items
   never move as a result.
5. Full List day headings: a free quest shows under the heading of the section
   it sits in; the "No date" group holds only free quests after every locked
   item. Items hidden by the look-ahead filter must not make a free quest jump.
6. Same behaviour in both apps. Keep `recurring.js` identical between them; if
   it must change, change both the same way.
7. Put the literal string `qm-free-reorder` somewhere that survives
   minification into the production bundle (e.g. a `data-` attribute value on
   the list) in both apps. The lead greps the live bundles for it.

## Acceptance checks (each must be run, not argued)

Write the order logic so it can be tested as plain functions and add tests
(use the repo's test runner if it has one; otherwise a node script committed
under `scripts/`). Cover at least:

- A. Free quest dropped between two dated quests stays there after reload;
  the dated quests remain in date order.
- B. Dragging never changes the relative order of locked items (try dropping a
  free quest at every index of a list with 3 locked and 3 free).
- C. Recurring quest with no time, placed third; simulate the next day's spawn
  (new task ID, same definition) → it is third.
- D. Recurring quest with a time (e.g. 08:00) is locked and sits in time order
  among today's dated items; it has no drag handle.
- E. Full List: free quest dropped between two missions stays there; turning
  Full List off shows it in the same position relative to the quests.
- F. Auto-sort on: drag a free quest to the top; it stays at the top while
  undragged free quests are auto-ordered; locked items stay in time order.
- G. An old saved order (array of task IDs, and the legacy bare array) loads
  with the same visible order as before this change.
- H. Two devices: the newer saved order wins on sync, as today, and the new
  "dragged" record travels with it.
- I. Side quest drag inside a parent card still works with Full List on and off.

Behaviour checks: run standalone locally (`npm run dev -- --port 5202
--strictPort` plus `npm run worker:dev`, local D1) and exercise A, C (by
creating a recurring quest and triggering the spawn path), D, E, F and I in the
browser. questmaster's list needs Google sign-in, which only runs on Vercel:
cover it with the tests plus `npm run build`, and say plainly which checks only
the live site can settle.

Paid AI: none needed. If spawning a recurring quest in `wrangler dev` triggers
a theme call, up to 5 such calls are fine; note the count.

## Return

Commit in small steps on `free-reorder` in each worktree, then queue the
candidate to the checker: branch and commit per repo, what you ran with
results, what you couldn't check. Start `docs/handoff/free-reorder-report.md`
in the questmaster worktree branch with the same. Stop dev servers when done.
