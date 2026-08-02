// Shared AI client for the theme/breakdown/habit endpoints.
// Leading underscore keeps Vercel from turning this into its own route
// (matches _auth.js and _rateLimit.js).
//
// Provider switch: AI_PROVIDER selects 'openai' (default) or 'anthropic'.
// AI_MODEL overrides the model for whichever provider is active; unset, it
// defaults to gpt-5.6-luna (openai) or claude-haiku-4-5 (anthropic) — so
// setting AI_PROVIDER=anthropic with no other changes reproduces the
// pre-migration behavior exactly, as a production rollback.

const AI_TIMEOUT_MS = 30000

// Single source of truth for provider/model resolution, shared by callAI,
// isAIConfigured, and the /api/ai-model endpoint (which surfaces this to the
// Settings UI).
export function getActiveModel() {
  const provider = process.env.AI_PROVIDER || 'openai'
  const model = process.env.AI_MODEL || (provider === 'anthropic' ? 'claude-haiku-4-5' : 'gpt-5.6-luna')
  return { provider, model }
}

export function isAIConfigured() {
  const { provider } = getActiveModel()
  return Boolean(provider === 'anthropic' ? process.env.ANTHROPIC_API_KEY : process.env.OPENAI_API_KEY)
}

async function callAnthropic({ system, prompt, maxTokens, temperature, model }) {
  const body = {
    model,
    max_tokens: maxTokens,
    messages: [{ role: 'user', content: prompt }],
  }
  if (system) body.system = system
  if (temperature !== undefined) body.temperature = temperature

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(AI_TIMEOUT_MS),
  })
  if (!res.ok) throw new Error(`Anthropic error ${res.status}`)
  return res.json()
}

async function callOpenAI({ system, prompt, openaiMaxTokens, jsonSchema, model }) {
  const messages = system ? [{ role: 'system', content: system }] : []
  messages.push({ role: 'user', content: prompt })

  const body = {
    model,
    max_completion_tokens: openaiMaxTokens,
    // Lowest effort Luna accepts — these are short titles/subtasks/flavor
    // text with no benefit from reasoning, and reasoning tokens eat into
    // max_completion_tokens.
    reasoning_effort: 'none',
    messages,
  }
  if (jsonSchema) {
    body.response_format = {
      type: 'json_schema',
      json_schema: { name: jsonSchema.name, schema: jsonSchema.schema, strict: true },
    }
  }

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(AI_TIMEOUT_MS),
  })
  if (!res.ok) throw new Error(`OpenAI error ${res.status}`)
  return res.json()
}

// Provider-neutral request. `maxTokens` is the Anthropic-path cap (unchanged
// from today); `openaiMaxTokens` is the raised OpenAI-path cap, since
// reasoning tokens there count against the same budget as output tokens.
// `temperature` is only ever forwarded on the Anthropic path — GPT-5-series
// reasoning models reject it.
export async function callAI({ system, prompt, maxTokens, openaiMaxTokens, jsonSchema, temperature }) {
  const { provider, model } = getActiveModel()
  if (provider === 'anthropic') {
    return callAnthropic({ system, prompt, maxTokens, temperature, model })
  }
  return callOpenAI({ system, prompt, openaiMaxTokens, jsonSchema, model })
}

// Handles both the Anthropic content-block shape and the OpenAI choices
// shape. A non-null refusal is treated as empty text so it falls through to
// each endpoint's existing regex-parse fallback rather than being parsed.
export function textOf(data) {
  if (Array.isArray(data.content)) {
    return data.content.find(b => b.type === 'text')?.text?.trim() || ''
  }
  const message = data.choices?.[0]?.message
  if (message?.refusal) return ''
  return message?.content?.trim() || ''
}

export function extractJson(text) {
  try {
    const match = text.match(/\{[\s\S]*\}/)
    if (match) return JSON.parse(match[0])
  } catch {}
  return null
}
