# Side quests on a quest Google won't nest under

Status: agreed 2026-09-15, not yet implemented. Applies to `questmaster` (the
Google Tasks app) only — `questmaster-standalone` doesn't use Google Tasks.

## The problem

Creating side quests on one particular quest put them loose in the main quest
list instead of under that quest. Every other quest, including QuestMaster's
own repeating quests, nested correctly.

Cause (confirmed by the user 2026-09-15): that quest was set to repeat inside
Google Tasks itself, not in QuestMaster. Google's Tasks API does not allow
repeating tasks — or tasks assigned from Docs/Chat — to be parent tasks
("Assigned and repeating tasks cannot be set as parent tasks",
https://developers.google.com/workspace/tasks/order). When
`createSubtask` (`src/utils/api.js`) inserts with `?parent=<that id>`, Google
does not return an error; it creates the task at the top level. The app never
checks where the task landed, so the user just sees stray quests.

QuestMaster's own repeating quests are unaffected: Google Tasks has no native
recurrence in QuestMaster's model, so each due day the app creates an ordinary
task from a def in `questmaster-recurring.json`, and ordinary tasks can have
subtasks.

## What we're building

When side quests are created, detect that Google refused to nest them, remove
the stray, and tell the user why — in the side-quest modal, which stays open.

### In scope

1. **Probe with the first side quest.** Create side quest #1, check where it
   landed. If refused, stop — don't create the rest. Worst case per attempt is
   one stray created and immediately deleted, not N.
2. **Detect refusal** by the `parent` field. Google's Task resource documents
   `parent` as output-only and "omitted if it is a top-level task". So a
   correctly nested insert should come back with `parent === parentId`.
3. **Confirm before deleting.** If the insert response lacks `parent` (or it
   differs), GET that task and re-check `parent` before deleting anything.
   *Why:* deleting is the only destructive thing this change does. If the
   insert response turned out not to carry `parent` even for good nesting,
   a response-only check would delete every legitimate side quest. The GET
   makes a false positive require Google to be wrong twice.
4. **Delete the confirmed stray** with the existing `deleteTask`.
5. **Explain in the modal, keep it open, keep the rows.** Suggested text:
   "Google won't let this quest have side quests because it repeats (or was
   assigned to you) in Google Tasks. To break it down, turn off its repeat in
   Google Tasks, or recreate it as a QuestMaster repeating quest."
   If deleting the stray failed, add that one loose copy was left in the main
   list. *Why in the modal, not a toast:* a toast vanishes in seconds and the
   modal currently closes, losing what the user typed; the explanation tells
   them what to do next, so it should stay put until they close it.
6. **Otherwise unchanged:** if the first side quest nested fine, create the
   rest exactly as today (toast, refetch, close).

### Out of scope, and why

- **Hiding/disabling the button up front.** The Tasks API exposes no
  recurrence or assignment field on a task, so the app can't know until it
  tries. (Implementer: confirm against the Task resource reference and report;
  if a usable field exists, report it rather than building on it.)
- **Remembering which tasks refused.** The probe already caps the cost at one
  create + one delete per attempt; a cache adds state for little gain.
- **Cleaning up strays created before this fix.** The user deletes those by
  hand.
- **Other creation failures** (network errors mid-loop etc.) keep today's
  behaviour: logged, skipped.
- **Side quests on QuestMaster repeating quests not carrying to the next day's
  copy.** Separate, existing behaviour.

## Steps

1. `src/utils/api.js` — add a small `getTask(token, taskId)` (GET
   `/tasks/v1/lists/@default/tasks/{id}`), following the existing helpers'
   style. Before writing the detection, verify on a normal quest that the
   insert response includes `parent`; report what you found.
2. `src/components/Dashboard.jsx` `handleCreateSideQuests` — probe, confirm,
   delete, stop, as above. Return a result the modal can act on (e.g.
   `{ refused: true, strayLeft: bool }`); only close the modal / toast /
   refetch on the success path. **Risk: this is the step that deletes a
   task** — the delete must be reachable only after the GET confirms.
3. `src/components/SideQuestModal.jsx` — `handleSubmit` currently sets
   `saving` and never resets it (the parent closes the modal). On a refused
   result: reset `saving`, show the message using the existing
   `.sidequest-note` style, keep rows.
4. `npm run build` passes. Commit and push to `main`. Push = production deploy
   (Vercel Git integration → questmaster-rouge.vercel.app). Confirm the new
   build is live.
5. **User's checks, after deploy** (need the user's Google account):
   - side quests on an ordinary quest still nest under it;
   - on a Google-repeating quest, the message appears and no loose quest is
     left in the main list.

No automated test suite exists in this project, so steps 4–5 are the
verification.
