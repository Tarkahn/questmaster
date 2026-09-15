# Report: side quests on a quest Google won't nest under

Plan: `docs/plans/sidequest-refused-parent.md`
Handoff: `docs/handoff/sidequest-refused-parent-implement.md`

## Pre-flight

`main` was ahead of `origin/main` by exactly 1 commit (`a0d725b`, the
planner's plan + handoff commit) and not behind at all — the expected,
harmless state per the handoff note. No other divergence. Proceeded.

## What was built (Steps 1-4)

- `src/utils/api.js` — added `getTask(token, taskId)`, a GET on
  `/tasks/v1/lists/@default/tasks/{id}`, following the existing helpers'
  style (same auth header, same error-throw convention).
- `src/components/Dashboard.jsx` `handleCreateSideQuests` — now probes with
  the first side quest only. If the insert response's `parent` doesn't match
  the intended parent, it GETs that task and only treats it as a confirmed
  refusal if the GET also disagrees (a failed GET is treated as "not
  confirmed" and falls through to normal behavior — never deletes on an
  unconfirmed suspicion). On confirmed refusal it deletes the stray via the
  existing `deleteTask`, does not create the remaining rows, and returns
  `{ refused: true, strayLeft }` (`strayLeft` true only if the delete itself
  failed). On success it behaves exactly as before (create rest, toast,
  refetch, close modal).
- `src/components/SideQuestModal.jsx` `handleSubmit` — now inspects
  `onCreate`'s return value. On `{ refused: true }` it resets `saving` (the
  parent no longer closes the modal in this path) and shows the plan's
  suggested message via the existing `.sidequest-note` style, appending a
  note about the leftover loose copy when `strayLeft` is true. Rows are left
  untouched since nothing clears them.

Staged and committed only the three files above by name (`git add
src/components/Dashboard.jsx src/components/SideQuestModal.jsx
src/utils/api.js`); `docs/luna-migration-prompts.md` stayed untracked and
was not touched.

## Verification requested in the handoff

**Step 1 — does a nested insert response carry `parent`?** Could not observe
this live: doing so needs the user's signed-in Google session, which this
subagent doesn't have. Per the handoff's fallback, I did not remove the GET
confirmation on the strength of documentation alone — `handleCreateSideQuests`
still GETs the task and only deletes when the GET independently agrees the
task didn't nest. Google's own Tasks API reference for the Task resource
(fetched today) documents `parent` as **output-only**, "This field is
omitted if it is a top-level task" — consistent with the plan's assumption
that a correctly nested insert returns `parent === parentId` and a top-level
one omits it, but this remains unverified against a live response.

**Recurrence/assignment field on the Task resource:** Confirmed no
recurrence field exists. There **is** an `assignmentInfo` field (output-only)
that identifies tasks assigned from Docs or Chat — `surfaceType` (DOCUMENT or
SPACE), plus `driveResourceInfo`/`spaceInfo` details — but it's populated
only "for tasks assigned to the current user," so it would cover at most the
"assigned" half of the two refusal causes the plan describes, never the
"repeating" half. Reporting it per the plan's instruction rather than
building on it: it can't reliably predict a refusal before trying, since a
Google-repeating (not assigned) parent — the case actually confirmed by the
user — carries no signal in it at all.

**`npm run build`:** Passed clean (`vite build`, 105 modules transformed, no
errors; only the pre-existing >500kB chunk-size advisory, unrelated to this
change).

**Commit and deploy:**
- Pushed commit `a758850` (`a75885021d8feef67ef87f1df0bee4dcfda70a33`) to
  `origin/main`, on top of the planner's `a0d725b` (`563d4eb..a758850
  main -> main`).
- Vercel: project `questmaster` (`prj_9JR4drX26KKAULmPrKlbkpqDeT8B`), most
  recent deployment `dpl_FwmdDCRaedr4oFSe7esQ8VvPH43P` — `state: READY`,
  `target: production`, `githubCommitSha` matches this push exactly
  (`a75885021d8feef67ef87f1df0bee4dcfda70a33`, branch `main`).
- Fetched `https://questmaster-rouge.vercel.app/` directly: response headers
  show `age: 0`, `x-vercel-cache: MISS`, `last-modified` at fetch time, and
  the served `index.html` references `/assets/index-CtSW90l9.js` — a
  different JS bundle filename than the one this build produced locally
  (`index-C5Cpsn3n.js`; the CSS hash matched). That's expected: Vercel's
  build environment differs from local (e.g. `VITE_GOOGLE_CLIENT_ID` and
  other env vars set in Production but not locally), so an unrelated hash
  mismatch is not a sign of a stale deploy — combined with the deployment
  record's exact commit-SHA match and READY/production state, this
  confirms the live site is serving this commit's build.

## Step 5

Left to the user, as instructed — not attempted here:
- side quests on an ordinary quest still nest under it;
- on a Google-repeating quest, the modal shows the explanation and no loose
  quest is left in the main list.

## Files touched

- `/Users/richardfoley/Documents/ClaudeCowork/TaskForge/questmaster/src/utils/api.js`
- `/Users/richardfoley/Documents/ClaudeCowork/TaskForge/questmaster/src/components/Dashboard.jsx`
- `/Users/richardfoley/Documents/ClaudeCowork/TaskForge/questmaster/src/components/SideQuestModal.jsx`
