# Implement: longer repeat periods for recurring quests

Plan (read fully first): `/Users/richardfoley/Documents/ClaudeCowork/TaskForge/questmaster/docs/plans/longer-repeat-periods.md`

Repos:
- `/Users/richardfoley/Documents/ClaudeCowork/TaskForge/questmaster`
- `/Users/richardfoley/Documents/ClaudeCowork/TaskForge/questmaster-standalone`

## Authority and push

The user approved this plan on 2026-09-15. **Both slices end in a push to
`main`, and each push is a production deploy** — questmaster via Vercel's Git
integration (questmaster-rouge.vercel.app); standalone via its GitHub Actions
workflow (go.tarkahn.cc). Push without asking again **once that repo's check
script passes, its build passes, and its real-data dry run shows nothing
unexpected** (plan steps 4 and 5). Do questmaster first and confirm it live
before starting standalone.

Before each push, re-derive git state yourself: `git fetch` and compare with
`origin/main`. Planner-made docs commits on `main` (plan/handoff/report files
under `docs/`) are fine to push with yours; anything else ahead or behind,
stop and report. Stage files by name, never `git add -A` — each repo has
untracked docs that aren't part of this.

## Stop and report instead of pushing if
- the real-data dry run would create any quest the old rule wouldn't today;
- the check script's old-build safety assertion fails;
- the real-data read is refused or you can't reach the data read-only — say
  exactly what you tried, and leave the command so the user can run it with
  `!`. Do not substitute invented defs for the real ones.

Only read the user's stored data; never write to it. In the report, list
what you found (titles + schedule + would-be-due old/new), nothing more.

## Verify and report
- Check script output for each repo (paste the pass/fail summary).
- Dry-run result for each repo, and where the data came from.
- Build result, pushed SHAs, deploy evidence (deployment/run state for that
  SHA + a new label string found in the live bundle).
- Anything in the plan you found to be wrong against the code — report it
  rather than silently working around it.
- Plan step 6 is the user's; don't attempt it on their accounts.

Write your report to
`/Users/richardfoley/Documents/ClaudeCowork/TaskForge/questmaster/docs/handoff/longer-repeat-periods-report.md`
and reply with that path only.
