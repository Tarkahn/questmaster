# Switch default model to gpt-6-luna — questmaster (Vercel)

Approved by Richard 2026-09-25. Ends in a push to `main`, which deploys production via Vercel's Git integration (canonical URL questmaster-rouge.vercel.app). Push and verify without asking again.

## Context
`api/_ai.js` already has a provider switch (AI_PROVIDER / AI_MODEL). The OpenAI default model is `gpt-5.6-luna` (line 18). Vercel production has no AI_MODEL or AI_PROVIDER env var set (checked with `vercel env ls`), so the code default is what production runs.

Verified from OpenAI's docs (developers.openai.com/api/docs/models/gpt-6-luna):
- Model ID `gpt-6-luna` (single snapshot). Chat Completions and Structured Outputs are supported.
- `reasoning_effort` accepts `none` (plus low/medium/high/xhigh/max), so the existing `'none'` stays valid.
- Pricing per 1M tokens: $0.10 in, $0.01 cached in, $0.50 out. Requests over 272K input tokens bill at 2x input/cache and 1.5x output.

## Change
1. `api/_ai.js`: change the OpenAI default from `gpt-5.6-luna` to `gpt-6-luna`, and update the header comment to match.
2. `.env.example`: update the AI_MODEL comment to name `gpt-6-luna`.
3. Grep `api/`, `src/` and `.env.example` for any other `5.6` / `luna` mention that states the current default, and update it. Leave historical docs under `docs/handoff/` alone.

Nothing else. Don't touch the Anthropic path, the token caps, the schemas, or the fallbacks.

## Commit rules
- Commit only the files above. `docs/luna-migration-prompts.md` is untracked and not yours; don't stage it.
- Also commit this brief and your report.

## Verify
- `npm run build` passes before you push.
- After pushing, confirm the Vercel production deployment for that commit reaches READY (Vercel MCP or `npx vercel ls`).
- Production endpoints need a live Google sign-in, so you can't call them yourself. If runtime logs are reachable, check for `OpenAI error` lines after the deploy. Then state plainly that the last check is Richard's: Settings should show `openai / gpt-6-luna`, and a newly themed quest should get a fantasy title rather than its own title back.

## Report
Write `docs/handoff/gpt-6-luna-default-report.md`: what changed (file:line), commit hash, deploy status, what you verified, and what's left for Richard.
