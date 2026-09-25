# Theme v2: rewritten prompt + medium thinking on gpt-6-luna (questmaster, Vercel)

Approved by Richard 2026-09-25. Ends in a push to `main`, which deploys production via Vercel. Push and verify without asking again. The same slice runs in parallel in `../questmaster-standalone`; the prompt text must be identical in both.

## Why
On gpt-6-luna at `reasoning_effort: 'none'`, `/api/theme` produces near-literal titles ("Read Thirty Pages of Dune"). A 4×2 test on 20 quests showed that neither higher thinking alone nor the new prompt alone fixes it. The rewritten prompt at `medium` does ("Study Thirty Leaves of Dune's Desert Chronicle"). The test harness is committed alongside this brief as `docs/handoff/theme-v2-eval.mjs`. Its `improvedSystem`, `improvedUser`, `schema` and `normalizeImproved` are the reference implementation. Richard will judge load times live and may roll back to Haiku with `AI_PROVIDER=anthropic`.

## Scope: /api/theme only, OpenAI path only
Breakdown and habit stay exactly as they are (effort `none`).

1. **Keep the Anthropic path byte-identical to today.** With `AI_PROVIDER=anthropic`, theme.js must send today's BASE_SYSTEM_PROMPT, today's user prompt, temperature 0.9, max_tokens 1024, and parse with today's regex/positional logic. This is Richard's likely rollback, so it has to reproduce current Haiku behaviour exactly. Branch on the active provider (use `getActiveModel()` from `_ai.js`).
2. **The OpenAI path uses the v2 prompt,** copied from the eval file, with two tightenings:
   - Rule 1 becomes: `Keep each themed title to 10 words or fewer — count them.`
   - In the AVOID list, add that modern possessives like "your" must never appear. (The medium-thinking run still let "Your" through several times, and one title reached 13 words.)
   - Glossary and stat glossary are appended as today. The stats instruction says "Return an empty list" rather than "Return {}", as in the eval.
   - The user message is the numbered list without the JSON template, as in `improvedUser`, including the notes lines.
3. **Structured output:** strict json_schema `{ items: [{ n, title, difficulty, stats: [{ stat, weight }] }] }`, as in the eval. The `stat` enum is built per request from the stat glossary ids. If no stat glossary is sent, make `stats` an array that the prompt says to leave empty, and keep the schema strict-valid (an enum can't be empty). Map results back by `n`, not by position. Missing or invalid entries fall back per item exactly as today (title → original, difficulty → normal, weights → {}). Convert `stats` back to the `{ STAT: weight }` object the client expects. Keep the regex parse as a fallback if the JSON parse fails.
4. **Thinking:** `reasoning_effort: 'medium'` for theme on OpenAI. `callAI` currently hardcodes `'none'`, so add an optional per-call effort that defaults to `'none'`, leaving breakdown and habit unchanged.
5. **Output cap:** theme `openaiMaxTokens` 4096 → 16000, since medium thinking used about 1,700 thinking tokens for 20 items.
6. **Timeout:** theme needs 60s. At medium, 20 items took about 23s. Make the timeout per-call, so theme gets 60000 and the others keep 30000. Then confirm the Vercel function limit allows 60s for `api/theme.js`: there's no `vercel.json` today, so check the project's function max duration (Vercel MCP `get_project`, or the docs for its plan and fluid-compute default). If it's below 60s, set `maxDuration` for that function (a `vercel.json` `functions` entry or an exported `config`) and say which you did. Also check that the client call site in `src/` has no shorter timeout of its own. None was found by grep, but confirm.
7. Response shape, route, auth, quota and every fallback status code stay unchanged.

## Verify
- `npm run build` passes.
- Offline, check your prompt, schema and parser by running a copy of the eval harness against your actual built prompt/schema functions, if you can import them without a key. Don't spend on the API from here: the key is only in Vercel. The live model check belongs to the standalone slice and to Richard.
- Push. Confirm the production deployment reaches READY, and check runtime logs for `OpenAI error` after deploy.
- Tell Richard exactly what to check: add or edit a quest, time how long its title takes to appear, and judge the title. Existing quests keep their cached titles unless re-themed.

## Commit
Commit only files you changed, plus this brief, `docs/handoff/theme-v2-eval.mjs` and your report. Don't stage `docs/luna-migration-prompts.md`.

## Report
`docs/handoff/theme-v2-luna-medium-report.md`: the changes (file:line), how the Anthropic path was kept identical, how the no-stat-glossary case is handled, the Vercel timeout finding and fix, commit hash, deploy status, and what Richard should check.
