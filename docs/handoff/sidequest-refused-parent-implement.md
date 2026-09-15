# Implement: side quests on a quest Google won't nest under

Project: `/Users/richardfoley/Documents/ClaudeCowork/TaskForge/questmaster`
Plan (read it fully first): `docs/plans/sidequest-refused-parent.md`

## Authority and push

The user approved this plan on 2026-09-15. **This slice ends in a push to
`main`, and that push deploys QuestMaster to production**
(Vercel Git integration, canonical URL questmaster-rouge.vercel.app). Push
without asking again once the build passes.

Before pushing, check that `main` is not behind or ahead of `origin/main` by
anything other than your own commits. If it is, stop and report — a push would
deploy work this plan never mentioned.

## Do

Steps 1–4 of the plan. Stage files by name, never `git add -A`
(`docs/luna-migration-prompts.md` is untracked and not part of this).

## Verify and report

- Step 1: whether a nested insert response actually carries `parent`. You
  may not be able to observe a live insert without the user's signed-in app;
  if you can't, say so plainly and rely on the GET confirmation in step 2 —
  do not remove that confirmation on the strength of documentation alone.
- Whether the Tasks API Task resource exposes any recurrence/assignment field.
- `npm run build` output (pass/fail).
- Commit hash pushed, and evidence the production deployment for that commit
  is live (deployment state + the served bundle changed). If you can't
  confirm, say what you checked.
- Step 5 checks are the user's — do not attempt them on their account.

Write your report to `docs/handoff/sidequest-refused-parent-report.md` and
reply with that path only.
