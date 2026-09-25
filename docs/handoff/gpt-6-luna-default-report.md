# Report: Switch default model to gpt-6-luna

Implements `docs/handoff/gpt-6-luna-default-implement.md`.

## What changed

- `api/_ai.js:7` — header comment updated from `gpt-5.6-luna` to `gpt-6-luna`.
- `api/_ai.js:18` — `getActiveModel()` OpenAI default changed from `'gpt-5.6-luna'` to `'gpt-6-luna'`. This is the line production actually runs, since Vercel has no `AI_MODEL`/`AI_PROVIDER` env vars set.
- `.env.example:21` — comment updated from `Defaults to gpt-5.6-luna` to `Defaults to gpt-6-luna`.

Grepped `api/`, `src/`, and `.env.example` for any other `5.6` / `luna` mentions after the edits — none remain outside the three lines above. Nothing else touched: Anthropic path, token caps, schemas, and fallbacks are all unchanged.

## Verify

- `npm run build` passed (vite build succeeded, PWA precache generated, only the pre-existing >500kB chunk-size warning, unrelated to this change).
- Committed and pushed to `main` as commit `1a730e8` ("Default OpenAI model to gpt-6-luna"). Only `api/_ai.js`, `.env.example`, this brief, and this report were staged — `docs/luna-migration-prompts.md` was left untracked as instructed.
- Vercel production deployment for commit `1a730e8`: **[fill after deploy check]**
- Runtime logs after deploy: **[fill after deploy check]**

## What's left for Richard

The last check is yours: in Settings, confirm it now shows `openai / gpt-6-luna`, and confirm a newly themed quest gets a fantasy title rather than getting its own title back (which would indicate an OpenAI-side error on the new model id being silently falling back).
