# Theme v2: rewritten prompt + medium thinking on gpt-6-luna — implementation report

Implements `docs/handoff/theme-v2-luna-medium-implement.md`.

## Changes

- `api/_ai.js`:
  - `AI_TIMEOUT_MS` renamed `DEFAULT_TIMEOUT_MS` (api/_ai.js:11-13), still 30000.
  - `callAnthropic` and `callOpenAI` take an optional `timeoutMs`, defaulting to `DEFAULT_TIMEOUT_MS` (api/_ai.js:27, 44, 50, 78).
  - `callOpenAI` takes an optional `reasoningEffort`, defaulting to `'none'` — unchanged behaviour for breakdown/habit, which don't pass it (api/_ai.js:50, 60).
  - `callAI`'s signature grew `reasoningEffort` and `timeoutMs`, both optional and forwarded through (api/_ai.js:88-95).
- `api/theme.js`:
  - Handler now reads `getActiveModel().provider` (api/theme.js:156) and branches before building any prompt.
  - **Anthropic branch** (api/theme.js:162-213): the exact code that was there before this slice — same `BASE_SYSTEM_PROMPT`, same glossary/stat-block string building, same user prompt template with the JSON example, same `callAI({ maxTokens: 1024, temperature: 0.9 })` (no `jsonSchema`, no `reasoningEffort`), same `extractJson` + positional-array parsing with the same per-field fallbacks. Nothing in this branch changed except that it's now gated behind the provider check.
  - **OpenAI branch** (api/theme.js:216-275): v2 system prompt (`buildOpenAiSystemPrompt`, api/theme.js:57-73) built from `BASE_SYSTEM_PROMPT` with rules 1 and 7 replaced exactly as in `docs/handoff/theme-v2-eval.mjs`'s `improvedSystem`, plus `V2_EXAMPLES` (api/theme.js:31-42, copied from the eval's `EXAMPLES` constant) with the two tightenings from the brief: rule 1 now reads "Keep each themed title to 10 words or fewer — count them," and the AVOID list has an explicit sentence calling out modern possessives ("your", "my", "our") by name. Glossary and stat-glossary blocks are appended after, in the same order as the current production code, with "Return an empty list" instead of "Return {}". User prompt is `Theme each numbered item...` with no JSON template, matching the eval's `improvedUser`. Schema (`buildOpenAiSchema`, api/theme.js:75-114) is the eval's `schema` verbatim, with the stat enum built per-request from `statGlossary` ids. `callAI` is called with `openaiMaxTokens: 16000`, `reasoningEffort: 'medium'`, `timeoutMs: 60000`, `jsonSchema: schema`.
  - `buildOpenAiSystemPrompt` and `buildOpenAiSchema` are exported (in addition to the default handler) purely so they could be imported for the offline verification below — Vercel's function bundler only looks at the default export, so this changes no runtime behaviour.

## Anthropic path — how "byte-identical" was kept

I didn't refactor the old code and hope it stayed the same — I left the original `BASE_SYSTEM_PROMPT` string, the glossary/stat-block concatenation, the user-prompt template, the `callAI` call, and the parsing/fallback logic exactly where they were, moved as one block inside `if (provider === 'anthropic') { ... }`. `git diff` on `api/theme.js` shows this literally: the Anthropic branch is the pre-existing lines, untouched, just re-indented one level and given a return statement. The only change to the wire request is that `openaiMaxTokens` (never read by `callAnthropic`) is no longer passed, which has no effect. `callAI`'s new `reasoningEffort`/`timeoutMs` params are optional and forwarded verbatim by `callAnthropic`'s existing `timeoutMs ?? DEFAULT_TIMEOUT_MS`, so the Anthropic branch's abort timeout is unchanged unless explicitly overridden. It isn't — the Anthropic branch doesn't pass `timeoutMs`, so it still gets the same 30000ms default as before this slice.

## No-stat-glossary case

Structured-output strict mode rejects an empty `enum`, so `buildOpenAiSchema` falls back to a single dummy enum value `['NONE']` when `statGlossary` is absent or empty (api/theme.js:55, 76-78). The system prompt tells the model in that case to "Return an empty `\"stats\"` list for every item" (api/theme.js:68-71) rather than mentioning the dummy value at all. When mapping the model's response back, any `stat === 'NONE'` entry is dropped rather than surfaced as a fake stat (api/theme.js:265-269) — belt and suspenders in case a model ever emits one despite the instruction.

## Vercel timeout finding and fix

No `vercel.json` existed before this slice, so `api/theme.js` was running under the platform's default function duration — which is well under 60s on both Hobby and Pro without an explicit `maxDuration` (10s/15s respectively, before Fluid Compute defaults are considered). Confirmed via `mcp__vercel__get_project`/`get_team` that this project (`questmaster`, team `richard-foley-s-projects`) had no function-duration override configured anywhere. I added `vercel.json` with:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "functions": {
    "api/theme.js": { "maxDuration": 60 }
  }
}
```

This only raises the ceiling for `api/theme.js`; breakdown, habit, and every other function keep the platform default. I also grepped `src/` for any client-side fetch timeout on the `/api/theme` call site (`src/utils/theme.js:87`) and found none — no `AbortSignal`/`AbortController`/timeout wraps that call, so nothing there needed changing.

## Verify

- `npm run build` — passes (Vite build; `api/*.js` aren't part of it, this just confirms nothing else broke).
- Offline eval-harness check: wrote a script that imports the real, exported `buildOpenAiSystemPrompt`/`buildOpenAiSchema` from `api/theme.js` (no API key, no network) and checks: rule 1/rule 7 wording, EXAMPLES/AVOID content including the new possessive-ban sentence, "empty list" vs "{}" wording, glossary append/omit, schema shape (`themed_items`, required fields, `additionalProperties: false`, difficulty enum), stat-enum construction from a glossary vs. the `['NONE']` fallback. It also reimplements the inline by-`n` mapping logic against a fake model response to confirm: mapping is by `n` not array position, a missing `n` falls back to the original title/`'normal'` difficulty, an invalid difficulty string falls back to `'normal'`, and a `'NONE'` stat is dropped while a real one passes through. All 22 checks passed. I did not call OpenAI or Anthropic — no API key is available outside Vercel, and the brief said not to spend on the API from here.
- Pushed to `main` as commit `482a879`; production deployment `dpl_FvKkhgrrrg9GZH5pvc33ZmPTBpxa` reached `READY`.

## What Richard should check

- On production (questmaster-rouge.vercel.app / quest.tarkahn.cc): add or edit a quest, or edit an existing one so it re-themes, and time how long the title takes to appear (expect roughly 15–25s for a single item at medium thinking, plus network/queueing — the eval's 20-item batch took ~23s). Judge whether the title clears the "not a near-literal restatement" bar the eval was chasing, and whether "your"/"my"/"our" ever slips through.
- Existing quests keep their cached titles — nothing re-themes until you add or edit one.
- If load time is worse than expected or the model choice needs reverting, `AI_PROVIDER=anthropic` in Vercel env vars rolls back to the exact pre-migration Haiku behaviour (verified above to be byte-identical).
- Runtime logs for `OpenAI error` after deploy: none found (checked both a full-text search for "OpenAI error" and a level filter for error/fatal, 30-minute window on the new deployment) — expected, since no real traffic has hit `/api/theme` yet.
